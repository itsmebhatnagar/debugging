import { randomUUID } from "node:crypto"
import { spawn, type ChildProcessByStdio } from "node:child_process"
import { accessSync, constants, realpathSync, statSync } from "node:fs"
import { basename, delimiter, isAbsolute, resolve } from "node:path"
import type { Readable, Writable } from "node:stream"
import { normalizeSupportedLanguage, type SupportedLanguage } from "../../code-language"
import { matchesExpectedOutput } from "../judging"
import type { ExecutionRequest, ExecutionResult, ExecutionService, ExecutionVerdict } from "../types"

const IMAGES: Record<SupportedLanguage, string> = {
  c: "gcc:16.2",
  cpp: "gcc:16.2",
  java: "eclipse-temurin:25-jdk",
}

const MAX_CODE_BYTES = 50_000
const MAX_INPUT_BYTES = 64_000
const MAX_EXPECTED_OUTPUT_BYTES = 64_000
const MAX_OUTPUT_BYTES = 64_000
const MAX_COMPILER_OUTPUT_BYTES = 256_000
const MAX_CONCURRENT_EXECUTIONS = 4
const MAX_QUEUED_EXECUTIONS = 20
const COMPILE_TIMEOUT_MS = 20_000
const EXECUTION_TIMEOUT_MS = 5_000
const DOCKER_COMMAND_TIMEOUT_MS = 30_000
const EXECUTION_COMMAND_TIMEOUT_MS = EXECUTION_TIMEOUT_MS + DOCKER_COMMAND_TIMEOUT_MS

interface DockerCommandResult {
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  outputLimitExceeded: boolean
}

interface DockerCommandOptions {
  executable: string
  input?: string
  timeoutMs?: number
  maxOutputBytes?: number
}

class DockerExecutableResolutionError extends Error {}

let activeExecutions = 0
const executionQueue: Array<() => void> = []
const imagePulls = new Map<string, Promise<void>>()
const compilerVersions = new Map<string, Promise<{ name: string; version: string }>>()

export class DockerExecutionService implements ExecutionService {
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    validateRequest(request)
    const language = normalizeSupportedLanguage(request.language)

    return withExecutionSlot(async () => {
      let executable: string
      try {
        executable = resolveDockerExecutable()
      } catch (error) {
        if (error instanceof DockerExecutableResolutionError) {
          throw new Error(`Docker CLI is unavailable. ${error.message}`)
        }
        throw error
      }
      await ensureDockerAvailable(executable)
      const image = IMAGES[language]
      await ensureImage(image, executable)
      return executeInContainer(request, language, image, executable)
    })
  }
}

async function executeInContainer(
  request: ExecutionRequest,
  language: SupportedLanguage,
  image: string,
  executable: string,
): Promise<ExecutionResult> {
  const containerName = `debugging-judge-${randomUUID()}`

  try {
    const create = await runDocker([
      "create",
      "--name", containerName,
      "--network", "none",
      "--read-only",
      "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges",
      "--pids-limit", "64",
      "--memory", "256m",
      "--memory-swap", "256m",
      "--cpus", "1",
      "--ulimit", "cpu=15:15",
      "--ulimit", "fsize=1048576:1048576",
      "--ulimit", "nofile=64:64",
      "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=32m,uid=10001,gid=10001,mode=700",
      "--tmpfs", "/work:rw,exec,nosuid,nodev,size=128m,uid=10001,gid=10001,mode=700",
      "--user", "10001:10001",
      "--workdir", "/work",
      image,
      "sleep",
      "3600",
    ], { executable, timeoutMs: DOCKER_COMMAND_TIMEOUT_MS })
    assertDockerSuccess(create, "container creation")

    const start = await runDocker(["start", containerName], { executable, timeoutMs: DOCKER_COMMAND_TIMEOUT_MS })
    assertDockerSuccess(start, "container startup")

    const entryPoint = language === "java" ? findJavaEntryPoint(request.code) : null
    const sourcePath = language === "java"
      ? `/work/${entryPoint}.java`
      : language === "cpp" ? "/work/main.cpp" : "/work/main.c"
    const source = await runDocker(
      ["exec", "-i", containerName, "/bin/sh", "-c", 'cat > "$1"', "sh", sourcePath],
      { executable, input: request.code, timeoutMs: DOCKER_COMMAND_TIMEOUT_MS },
    )
    assertDockerSuccess(source, "source transfer")

    const compileArgs = getCompileArguments(language, sourcePath)
    const compilation = await runDocker(
      ["exec", "-e", "TMPDIR=/work", containerName, ...compileArgs],
      { executable, timeoutMs: COMPILE_TIMEOUT_MS, maxOutputBytes: MAX_COMPILER_OUTPUT_BYTES },
    )

    if (compilation.timedOut || compilation.outputLimitExceeded) {
      await stopContainer(containerName, executable)
      return makeResult({
        verdict: compilation.timedOut ? "Time Limit Exceeded" : "Output Limit Exceeded",
        statusId: compilation.timedOut ? 5 : 12,
        compileOutput: combinedOutput(compilation),
      })
    }

    if (compilation.exitCode !== 0 && compilation.exitCode !== null) {
      assertNotDockerInfrastructureFailure(compilation, "compiler initialization")
      const outOfMemory = await wasKilledForMemory(containerName, executable)
      return makeResult({
        verdict: outOfMemory ? "Memory Limit Exceeded" : "Compilation Error",
        statusId: outOfMemory ? 8 : 6,
        compileOutput: combinedOutput(compilation),
      })
    }
    assertDockerSuccess(compilation, "compilation")

    const compiler = await getCompilerVersion(containerName, language, image, executable)
    const guestTimeout = `${EXECUTION_TIMEOUT_MS / 1000}s`
    const runArgs = language === "java"
      ? ["exec", "-i", containerName, "timeout", "--signal=KILL", "--kill-after=1s", guestTimeout, "java", "-Xmx128m", "-Xss1m", "-XX:ActiveProcessorCount=1", "-cp", "/work", entryPoint ?? "Main"]
      : ["exec", "-i", containerName, "timeout", "--signal=KILL", "--kill-after=1s", guestTimeout, "/work/program"]
    const executionStartedAt = Date.now()
    const execution = await runDocker(runArgs, {
      executable,
      input: request.input,
      timeoutMs: EXECUTION_COMMAND_TIMEOUT_MS,
      maxOutputBytes: MAX_OUTPUT_BYTES,
    })
    const executionDuration = (Date.now() - executionStartedAt) / 1000

    if (execution.timedOut) {
      throw new Error("Docker execution request timed out before the sandbox returned a result.")
    }

    if (execution.outputLimitExceeded) {
      await stopContainer(containerName, executable)
      return makeResult({
        verdict: "Output Limit Exceeded",
        statusId: 12,
        stdout: execution.stdout,
        stderr: execution.stderr,
        compileOutput: combinedOutput(compilation),
        compilerName: compiler.name,
        compilerVersion: compiler.version,
        time: executionDuration,
      })
    }

    if (execution.exitCode === 124 || execution.exitCode === 137) {
      const outOfMemory = await wasKilledForMemory(containerName, executable)
      return makeResult({
        verdict: outOfMemory ? "Memory Limit Exceeded" : "Time Limit Exceeded",
        statusId: outOfMemory ? 8 : 5,
        stdout: execution.stdout,
        stderr: execution.stderr,
        compileOutput: combinedOutput(compilation),
        compilerName: compiler.name,
        compilerVersion: compiler.version,
        time: executionDuration,
      })
    }

    if (execution.exitCode !== 0 && execution.exitCode !== null) {
      assertNotDockerInfrastructureFailure(execution, "container execution")
      const outOfMemory = await wasKilledForMemory(containerName, executable)
      return makeResult({
        verdict: outOfMemory ? "Memory Limit Exceeded" : "Runtime Error",
        statusId: outOfMemory ? 8 : 11,
        stdout: execution.stdout,
        stderr: execution.stderr,
        compileOutput: combinedOutput(compilation),
        compilerName: compiler.name,
        compilerVersion: compiler.version,
        time: executionDuration,
      })
    }

    assertDockerSuccess(execution, "program execution")
    const passed = matchesExpectedOutput(execution.stdout, request.expectedOutput, request.judgingMode)
    return makeResult({
      verdict: passed ? "Accepted" : "Wrong Answer",
      statusId: passed ? 3 : 4,
      stdout: execution.stdout,
      stderr: execution.stderr,
      compileOutput: combinedOutput(compilation),
      compilerName: compiler.name,
      compilerVersion: compiler.version,
      time: executionDuration,
    })
  } finally {
    await removeContainer(containerName, executable)
  }
}

function getCompileArguments(
  language: SupportedLanguage,
  sourcePath: string,
): string[] {
  if (language === "java") {
    return ["javac", "-encoding", "UTF-8", "-d", "/work", sourcePath]
  }

  const compiler = language === "cpp" ? "g++" : "gcc"
  const standard = language === "cpp" ? "-std=c++20" : "-std=c17"
  return [compiler, "-O2", standard, sourcePath, "-o", "/work/program"]
}

function findJavaEntryPoint(code: string): string {
  const withoutCommentsAndLiterals = code.replace(
    /\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/gu,
    " ",
  )
  const publicDeclaration = withoutCommentsAndLiterals.match(
    /\bpublic\s+(?:(?:abstract|final|sealed|non-sealed|strictfp)\s+)*(?:class|interface|enum|record)\s+([A-Za-z_$][\w$]*)/u,
  )
  if (publicDeclaration) return publicDeclaration[1]

  const classDeclarations = /\bclass\s+([A-Za-z_$][\w$]*)\b[^{}]*\{/gu
  for (const declaration of withoutCommentsAndLiterals.matchAll(classDeclarations)) {
    const openingBrace = declaration.index + declaration[0].lastIndexOf("{")
    let depth = 1
    let closingBrace = openingBrace + 1
    while (closingBrace < withoutCommentsAndLiterals.length && depth > 0) {
      if (withoutCommentsAndLiterals[closingBrace] === "{") depth++
      if (withoutCommentsAndLiterals[closingBrace] === "}") depth--
      closingBrace++
    }
    const classBody = withoutCommentsAndLiterals.slice(openingBrace + 1, closingBrace - 1)
    if (/\bpublic\s+static\s+void\s+main\s*\(/u.test(classBody)) return declaration[1]
  }

  return "Main"
}

async function getCompilerVersion(
  containerName: string,
  language: SupportedLanguage,
  image: string,
  executable: string,
): Promise<{ name: string; version: string }> {
  const key = `${image}:${language}`
  let versionCheck = compilerVersions.get(key)
  if (!versionCheck) {
    versionCheck = queryCompilerVersion(containerName, language, executable)
    compilerVersions.set(key, versionCheck)
  }

  try {
    return await versionCheck
  } catch (error) {
    compilerVersions.delete(key)
    throw error
  }
}

async function queryCompilerVersion(
  containerName: string,
  language: SupportedLanguage,
  executable: string,
): Promise<{ name: string; version: string }> {
  const tool = language === "java" ? "javac" : language === "cpp" ? "g++" : "gcc"
  const args = language === "java"
    ? ["exec", containerName, "javac", "-version"]
    : ["exec", containerName, tool, "-dumpfullversion"]
  const result = await runDocker(args, { executable, timeoutMs: DOCKER_COMMAND_TIMEOUT_MS, maxOutputBytes: 1024 })
  assertDockerSuccess(result, "compiler version check")
  const versionOutput = `${result.stdout}\n${result.stderr}`
  const version = language === "java"
    ? versionOutput.match(/javac\s+([^\s]+)/u)?.[1]
    : versionOutput.trim().split(/\r?\n/u).find(Boolean)
  if (!version) throw new Error("The compiler container returned no toolchain version.")
  return {
    name: language === "java" ? "OpenJDK" : language === "cpp" ? "G++" : "GCC",
    version,
  }
}

function validateRequest(request: ExecutionRequest): void {
  if (
    typeof request !== "object"
    || request === null
    || typeof request.language !== "string"
    || typeof request.code !== "string"
    || typeof request.input !== "string"
    || typeof request.expectedOutput !== "string"
  ) {
    throw new Error("Invalid execution request.")
  }
  if (Buffer.byteLength(request.code, "utf8") > MAX_CODE_BYTES) {
    throw new Error(`Source code exceeds the ${MAX_CODE_BYTES}-byte execution limit.`)
  }
  if (Buffer.byteLength(request.input, "utf8") > MAX_INPUT_BYTES) {
    throw new Error(`Program input exceeds the ${MAX_INPUT_BYTES}-byte execution limit.`)
  }
  if (Buffer.byteLength(request.expectedOutput, "utf8") > MAX_EXPECTED_OUTPUT_BYTES) {
    throw new Error(`Expected output exceeds the ${MAX_EXPECTED_OUTPUT_BYTES}-byte execution limit.`)
  }
  if (!request.code.trim()) throw new Error("Source code cannot be empty.")
}

async function ensureDockerAvailable(executable: string): Promise<void> {
  try {
    const result = await runDocker(["version", "--format", "{{.Server.Version}}"], {
      executable,
      timeoutMs: DOCKER_COMMAND_TIMEOUT_MS,
      maxOutputBytes: 1024,
    })
    if (result.exitCode === 0 && result.stdout.trim()) return
    const detail = combinedOutput(result)
    if (detail) {
      throw new Error(`Docker Engine reported an error: ${detail.slice(-1000)}`)
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Docker Engine reported an error:")) {
      throw error
    }
    if (error instanceof DockerExecutableResolutionError || (error instanceof Error && error.message.startsWith("Docker CLI process error:"))) {
      throw new Error(`Docker CLI is unavailable. ${error.message}`)
    }
    throw new Error(
      `Docker Engine is unavailable. Start Docker Desktop and verify \`docker version\`. ${error instanceof Error ? error.message : ""}`.trim(),
    )
  }
  throw new Error("Docker Engine is unavailable. Start Docker Desktop and verify `docker version`.")
}

async function ensureImage(image: string, executable: string): Promise<void> {
  let imagePull = imagePulls.get(image)
  if (!imagePull) {
    imagePull = (async () => {
      const inspect = await runDocker(["image", "inspect", "--format", "{{.Id}}", image], {
        executable,
        timeoutMs: DOCKER_COMMAND_TIMEOUT_MS,
        maxOutputBytes: 1024,
      })
      if (inspect.exitCode === 0) return
      if (inspect.timedOut || inspect.outputLimitExceeded) {
        assertDockerSuccess(inspect, "image inspection")
      }

      const inspectError = combinedOutput(inspect)
      if (!inspectError.includes("No such image")) {
        throw new Error(`Docker image inspection failed for ${image}${inspectError ? `: ${inspectError.slice(-1000)}` : "."}`)
      }

      const pull = await runDocker(["pull", image], {
        executable,
        timeoutMs: 5 * 60_000,
        maxOutputBytes: 1_000_000,
      })
      if (pull.exitCode !== 0 || pull.timedOut) {
        throw new Error(`Could not pull required compiler image ${image}: ${combinedOutput(pull).slice(-1000)}`)
      }
    })()
    imagePulls.set(image, imagePull)
  }

  try {
    await imagePull
  } catch (error) {
    imagePulls.delete(image)
    throw error
  }
}

async function wasKilledForMemory(containerName: string, executable: string): Promise<boolean> {
  const result = await runDocker(
    ["inspect", "--format", "{{.State.OOMKilled}}", containerName],
    { executable, timeoutMs: DOCKER_COMMAND_TIMEOUT_MS, maxOutputBytes: 1024 },
  )
  assertDockerSuccess(result, "memory-limit inspection")
  return result.exitCode === 0 && result.stdout.trim() === "true"
}

async function stopContainer(containerName: string, executable: string): Promise<void> {
  const result = await runDocker(["kill", containerName], {
    executable,
    timeoutMs: DOCKER_COMMAND_TIMEOUT_MS,
    maxOutputBytes: 1024,
  })
  const output = combinedOutput(result)
  if (result.exitCode !== 0 && !output.includes("is not running") && !output.includes("No such container")) {
    throw new Error(`Could not stop judge container: ${output.slice(-1000)}`)
  }
}

async function removeContainer(containerName: string, executable: string): Promise<void> {
  const result = await runDocker(["rm", "--force", containerName], {
    executable,
    timeoutMs: DOCKER_COMMAND_TIMEOUT_MS,
    maxOutputBytes: 1024,
  })
  if (result.exitCode !== 0 && !combinedOutput(result).includes("No such container")) {
    console.error("[Docker judge cleanup failure]", combinedOutput(result))
    throw new Error("Could not remove the temporary judge container.")
  }
}

async function runDocker(
  args: string[],
  options: DockerCommandOptions,
): Promise<DockerCommandResult> {
  const timeoutMs = options.timeoutMs ?? DOCKER_COMMAND_TIMEOUT_MS
  const maxOutputBytes = options.maxOutputBytes ?? MAX_COMPILER_OUTPUT_BYTES

  return new Promise((resolve, reject) => {
    let child: ChildProcessByStdio<Writable, Readable, Readable>
    try {
      child = spawn(options.executable, args, {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"] as const,
      })
    } catch (error) {
      reject(error instanceof DockerExecutableResolutionError
        ? error
        : new Error(`Docker CLI process error: ${error instanceof Error ? error.message : "unknown error"}`))
      return
    }

    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let capturedBytes = 0
    let timedOut = false
    let outputLimitExceeded = false
    let settled = false

    const capture = (target: Buffer[], chunk: Buffer) => {
      const remaining = Math.max(0, maxOutputBytes - capturedBytes)
      if (remaining > 0) target.push(chunk.subarray(0, remaining))
      capturedBytes += chunk.length
      if (capturedBytes > maxOutputBytes) {
        outputLimitExceeded = true
        child.kill()
      }
    }

    child.stdout.on("data", (chunk: Buffer) => capture(stdout, chunk))
    child.stderr.on("data", (chunk: Buffer) => capture(stderr, chunk))
    child.stdin.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code !== "EPIPE") fail(error)
    })

    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, timeoutMs)

    function fail(error: Error): void {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error(`Docker CLI process error: ${error.message}`))
    }

    child.on("error", fail)
    child.on("close", (exitCode) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({
        exitCode,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        timedOut,
        outputLimitExceeded,
      })
    })

    if (options.input === undefined) child.stdin.end()
    else child.stdin.end(options.input)
  })
}

function resolveDockerExecutable(): string {
  const configuredPath = getEnvironmentValue("DOCKER_PATH")?.trim()
  if (configuredPath) {
    return validateDockerExecutable(configuredPath, "DOCKER_PATH")
  }

  const executableName = process.platform === "win32" ? "docker.exe" : "docker"
  const pathEntries = (getEnvironmentValue("PATH") ?? "").split(delimiter).filter(Boolean)
  for (const pathEntry of pathEntries) {
    const candidate = resolve(pathEntry, executableName)
    try {
      return validateDockerExecutable(candidate, "PATH")
    } catch {
      continue
    }
  }

  // Check common default install paths
  const standardPaths = process.platform === "win32"
    ? [
        "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
        "C:\\Program Files\\Docker\\Docker\\resources\\docker.exe",
        "C:\\Program Files\\Docker\\Docker\\docker.exe",
        "C:\\ProgramData\\DockerDesktop\\version-bin\\docker.exe",
      ]
    : [
        "/usr/local/bin/docker",
        "/usr/bin/docker",
        "/bin/docker",
        "/snap/bin/docker",
      ];

  for (const candidate of standardPaths) {
    try {
      return validateDockerExecutable(candidate, "Default Path")
    } catch {
      continue
    }
  }

  throw new DockerExecutableResolutionError(
    `Docker CLI was not found in the backend process PATH. ` +
    (process.platform === "win32"
      ? "Set DOCKER_PATH to the absolute path of docker.exe."
      : "Set DOCKER_PATH to the absolute path of the docker executable."),
  )
}

function getEnvironmentValue(name: string): string | undefined {
  const entry = Object.entries(process.env).find(([key]) => key.toLowerCase() === name.toLowerCase())
  return entry?.[1]
}

function validateDockerExecutable(candidate: string, source: string): string {
  if (!isAbsolute(candidate)) {
    throw new DockerExecutableResolutionError(`${source} must be an absolute path to the Docker executable.`)
  }

  let resolvedPath: string
  try {
    resolvedPath = realpathSync(candidate)
  } catch (error) {
    const detail = error instanceof Error ? error.message : "file does not exist"
    throw new DockerExecutableResolutionError(`${source} does not point to an accessible Docker executable: ${detail}`)
  }

  const expectedName = process.platform === "win32" ? "docker.exe" : "docker"
  if (basename(resolvedPath).toLowerCase() !== expectedName) {
    throw new DockerExecutableResolutionError(`${source} must point to a file named ${expectedName}.`)
  }

  try {
    if (!statSync(resolvedPath).isFile()) {
      throw new DockerExecutableResolutionError(`${source} must point to a regular Docker executable file.`)
    }
    accessSync(resolvedPath, constants.X_OK)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${source} must point to`)) {
      throw error
    }
    const detail = error instanceof Error ? error.message : "file is not accessible"
    throw new DockerExecutableResolutionError(`${source} does not point to an accessible Docker executable: ${detail}`)
  }

  return resolvedPath
}

function assertDockerSuccess(result: DockerCommandResult, operation: string): void {
  if (result.timedOut) throw new Error(`Docker ${operation} timed out.`)
  if (result.outputLimitExceeded) throw new Error(`Docker ${operation} exceeded its output limit.`)
  if (result.exitCode !== 0) {
    const detail = combinedOutput(result).slice(-1000)
    throw new Error(`Docker ${operation} failed${detail ? `: ${detail}` : "."}`)
  }
}

function assertNotDockerInfrastructureFailure(result: DockerCommandResult, operation: string): void {
  const output = combinedOutput(result)
  if (/(?:OCI runtime exec failed|Error response from daemon|Cannot connect to the Docker daemon|No such container|container is not running|executable file not found)/iu.test(output)) {
    throw new Error(`Docker ${operation} failed: ${output.slice(-1000)}`)
  }
}

function combinedOutput(result: DockerCommandResult): string {
  return [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
}

function makeResult(options: {
  verdict: ExecutionVerdict
  statusId: number
  stdout?: string | null
  stderr?: string | null
  compileOutput?: string | null
  compilerName?: string
  compilerVersion?: string
  time?: number | null
}): ExecutionResult {
  return {
    stdout: options.stdout ?? null,
    stderr: options.stderr ?? null,
    compileOutput: options.compileOutput ?? null,
    time: options.time ?? null,
    memory: null,
    statusId: options.statusId,
    statusDescription: options.verdict,
    verdict: options.verdict,
    passed: options.verdict === "Accepted",
    ...(options.compilerName ? { compilerName: options.compilerName } : {}),
    ...(options.compilerVersion ? { compilerVersion: options.compilerVersion } : {}),
  }
}

async function withExecutionSlot<T>(operation: () => Promise<T>): Promise<T> {
  if (activeExecutions >= MAX_CONCURRENT_EXECUTIONS) {
    if (executionQueue.length >= MAX_QUEUED_EXECUTIONS) {
      throw new Error("Judge is busy. Please retry your submission shortly.")
    }
    await new Promise<void>((resolve) => executionQueue.push(resolve))
  } else {
    activeExecutions++
  }

  try {
    return await operation()
  } finally {
    const next = executionQueue.shift()
    if (next) next()
    else activeExecutions--
  }
}
