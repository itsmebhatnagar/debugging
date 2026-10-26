import { normalizeSupportedLanguage, type SupportedLanguage } from "../../code-language"
import { matchesExpectedOutput } from "../judging"
import type { ExecutionRequest, ExecutionResult, ExecutionService, ExecutionVerdict } from "../types"

interface Judge0Language {
  id: number
  name: string
}

function isValidStatus(
  status: unknown
): status is NonNullable<Judge0Submission["status"]> {
  return typeof status === "object"
    && status !== null
    && "id" in status
    && typeof status.id === "number"
    && Number.isInteger(status.id)
    && "description" in status
    && typeof status.description === "string"
}

function isJudge0Language(value: unknown): value is Judge0Language {
  return isRecord(value)
    && typeof value.id === "number"
    && Number.isInteger(value.id)
    && value.id > 0
    && typeof value.name === "string"
    && value.name.length > 0
}

interface Judge0Submission {
  token?: string
  stdout?: string | null
  stderr?: string | null
  compile_output?: string | null
  time?: string | null
  memory?: number | null
  exit_code?: number | null
  status?: { id: number; description: string }
}

function isJudge0Submission(value: unknown): value is Judge0Submission {
  return isRecord(value)
    && (value.token === undefined || typeof value.token === "string")
    && (value.status === undefined || isValidStatus(value.status))
    && (value.stdout === undefined || value.stdout === null || typeof value.stdout === "string")
    && (value.stderr === undefined || value.stderr === null || typeof value.stderr === "string")
    && (value.compile_output === undefined || value.compile_output === null || typeof value.compile_output === "string")
    && (value.time === undefined || value.time === null || typeof value.time === "string")
    && (value.memory === undefined || value.memory === null || isFiniteNumber(value.memory))
    && (value.exit_code === undefined || value.exit_code === null || Number.isInteger(value.exit_code))
}

function hasCompletedResultFields(value: Judge0Submission): boolean {
  return isValidStatus(value.status)
    && value.status.id !== 1
    && value.status.id !== 2
    && "stdout" in value
    && "stderr" in value
    && "compile_output" in value
    && "time" in value
    && "memory" in value
    && "exit_code" in value
}

interface Compiler {
  id: number
  name: string
  version: string
}

const EXECUTION_LIMITS = {
  cpu_time_limit: 2,
  cpu_extra_time: 1,
  wall_time_limit: 5,
  memory_limit: 128_000,
  stack_limit: 64_000,
  max_processes_and_or_threads: 30,
  max_file_size: 1_024,
  enable_network: false,
} as const

const MAX_CODE_BYTES = 50_000
const MAX_INPUT_BYTES = 64_000
const MAX_EXPECTED_OUTPUT_BYTES = 64_000
const MAX_POLL_DURATION_MS = 30_000
const POLL_INTERVAL_MS = 750
const REQUEST_TIMEOUT_MS = 10_000

const COMPILERS: Record<SupportedLanguage, { name: string; pattern: RegExp }> = {
  c: { name: "GCC", pattern: /^C \(GCC ([\d.]+)\)$/i },
  cpp: { name: "G++", pattern: /^C\+\+ \((?:G\+\+|GCC) ([\d.]+)\)$/i },
  java: { name: "OpenJDK", pattern: /^Java \(OpenJDK ([\d.]+)\)$/i },
}

export class Judge0ExecutionService implements ExecutionService {
  private readonly apiUrl: URL
  private readonly authHeaders: Record<string, string>
  private languagesPromise: Promise<Judge0Language[]> | null = null

  constructor() {
    const configuredUrl = process.env.JUDGE0_API_URL?.trim()
    if (!configuredUrl) {
      throw new Error("Compiler service not configured. Set JUDGE0_API_URL to a hosted Judge0-compatible API.")
    }

    let apiUrl: URL
    try {
      apiUrl = new URL(configuredUrl)
    } catch {
      throw new Error("JUDGE0_API_URL must be a valid HTTPS URL.")
    }

    if (apiUrl.protocol !== "https:" || apiUrl.username || apiUrl.password || apiUrl.search || apiUrl.hash) {
      throw new Error("JUDGE0_API_URL must use HTTPS and must not contain credentials, query parameters, or fragments.")
    }

    this.apiUrl = apiUrl

    const authnToken = process.env.JUDGE0_AUTHN_TOKEN?.trim()
    const authzToken = process.env.JUDGE0_AUTHZ_TOKEN?.trim()
    this.authHeaders = {
      ...(authnToken ? { "X-Auth-Token": authnToken } : {}),
      ...(authzToken ? { "X-Auth-User": authzToken } : {}),
    }
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    this.validateRequest(request)
    const language = normalizeSupportedLanguage(request.language)
    const compiler = await this.getLatestCompiler(language)

    const submissionBody: Record<string, string | number | boolean> = {
      source_code: request.code,
      language_id: compiler.id,
      stdin: request.input,
      ...EXECUTION_LIMITS,
    }

    const response = await this.request<unknown>("/submissions?base64_encoded=false&wait=false", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders },
      body: JSON.stringify(submissionBody),
    })
    if (!isJudge0Submission(response)) {
      throw new Error("Judge0 returned an invalid submission response.")
    }
    const submission = response

    const isComplete = submission.status && submission.status.id !== 1 && submission.status.id !== 2
    const result = isComplete
      ? submission
      : submission.token
        ? await this.waitForSubmission(submission.token)
        : null

    if (!result?.status) {
      throw new Error("Judge0 returned an invalid submission response without a status or polling token.")
    }
    if (!hasCompletedResultFields(result)) {
      throw new Error("Judge0 returned a completed submission without the required execution result fields.")
    }

    const verdict = getVerdict(result, request.expectedOutput)
    return {
      stdout: result.stdout ?? null,
      stderr: result.stderr ?? null,
      compileOutput: result.compile_output ?? null,
      time: parseExecutionTime(result.time),
      memory: isFiniteNumber(result.memory) ? result.memory : null,
      statusId: result.status.id,
      statusDescription: verdict,
      verdict,
      passed: verdict === "Accepted",
      compilerName: compiler.name,
      compilerVersion: compiler.version,
    }
  }

  private validateRequest(request: ExecutionRequest): void {
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

    if (!request.code.trim()) {
      throw new Error("Source code cannot be empty.")
    }
  }

  private async getLatestCompiler(language: SupportedLanguage): Promise<Compiler> {
    const config = COMPILERS[language]
    const compilers = (await this.getLanguages())
      .map((compiler) => {
        const match = compiler.name.match(config.pattern)
        return match
          ? { id: compiler.id, name: config.name, version: match[1] }
          : null
      })
      .filter((compiler): compiler is Compiler => compiler !== null)
      .sort((left, right) => compareVersions(right.version, left.version))

    const latest = compilers[0]
    if (!latest) {
      throw new Error(
        `The configured Judge0 service does not offer a supported ${config.name} runtime for ${language}. ` +
        `Install or enable that runtime in the hosted compiler service and expose it through /languages.`
      )
    }

    return latest
  }

  private async getLanguages(): Promise<Judge0Language[]> {
    if (!this.languagesPromise) {
      this.languagesPromise = this.request<Judge0Language[]>("/languages", {
        method: "GET",
        headers: this.authHeaders,
      }).then((languages) => {
        if (!Array.isArray(languages) || !languages.every(isJudge0Language)) {
          throw new Error("Judge0 returned an invalid language catalog.")
        }
        return languages
      }).catch((error: unknown) => {
        this.languagesPromise = null
        throw error
      })
    }

    return this.languagesPromise
  }

  private async waitForSubmission(token: string): Promise<Judge0Submission> {
    const deadline = Date.now() + MAX_POLL_DURATION_MS

    while (Date.now() < deadline) {
      await delay(Math.min(POLL_INTERVAL_MS, deadline - Date.now()))
      if (Date.now() >= deadline) break
      const response = await this.request<unknown>(
        `/submissions/${encodeURIComponent(token)}?base64_encoded=false`,
        { method: "GET", headers: this.authHeaders },
        Math.min(REQUEST_TIMEOUT_MS, Math.max(1, deadline - Date.now())),
      )

      if (!isJudge0Submission(response)) {
        throw new Error("Judge0 returned an invalid polled submission.")
      }
      const submission = response
      if (!isValidStatus(submission.status)) {
        throw new Error("Judge0 returned an invalid polled submission without a status.")
      }

      if (submission.status.id !== 1 && submission.status.id !== 2) {
        return submission
      }
    }

    throw new Error(`Code execution exceeded the ${MAX_POLL_DURATION_MS / 1000}-second service response limit.`)
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<T> {
    let response: Response
    try {
      response = await fetch(new URL(path.replace(/^\/+/, ""), ensureTrailingSlash(this.apiUrl)), {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      })
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Network request failed."
      throw new Error(`Could not reach the configured Judge0 service: ${detail}`)
    }

    const responseText = await response.text()
    if (!response.ok) {
      const detail = responseText.slice(0, 1000)
      throw new Error(`Judge0 request failed with HTTP ${response.status}${detail ? `: ${detail}` : "."}`)
    }

    try {
      return JSON.parse(responseText) as T
    } catch {
      throw new Error("Judge0 returned a successful response that was not valid JSON.")
    }
  }
}

function ensureTrailingSlash(url: URL): URL {
  const normalized = new URL(url)
  if (!normalized.pathname.endsWith("/")) normalized.pathname += "/"
  return normalized
}

function parseExecutionTime(time: string | null | undefined): number | null {
  if (time == null) return null
  const parsed = Number(time)
  return Number.isFinite(parsed) ? parsed : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function getVerdict(result: Judge0Submission, expectedOutput: string): ExecutionVerdict {
  if (!isValidStatus(result.status)) {
    throw new Error("Judge0 returned a completed submission without a valid status.")
  }

  switch (result.status.id) {
    case 3:
    case 4:
      if (!isFiniteNumber(result.exit_code)) {
        throw new Error("Judge0 returned a successful execution without an exit code.")
      }
      if (result.exit_code !== 0) {
        return "Runtime Error"
      }
      return matchesExpectedOutput(result.stdout ?? null, expectedOutput) ? "Accepted" : "Wrong Answer"
    case 5:
      return "Time Limit Exceeded"
    case 6:
      return "Compilation Error"
    case 13:
      return "Internal Error"
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
    case 12:
    case 14:
      return "Runtime Error"
    default:
      throw new Error(`Judge0 returned an unsupported terminal status ID: ${result.status.id}.`)
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.match(/\d+/g)?.map(Number) ?? []
  const rightParts = right.match(/\d+/g)?.map(Number) ?? []
  const partCount = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < partCount; index++) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (difference !== 0) return difference
  }

  return left.localeCompare(right)
}
