import * as vm from "node:vm"
import { exec, execSync } from "node:child_process"
import { writeFileSync, existsSync, unlinkSync, mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { randomUUID } from "node:crypto"
import { ExecutionRequest, ExecutionResult, ExecutionService, ExecutionVerdict } from "../types"
import { matchesExpectedOutput } from "../judging"

export class LocalVMExecutionService implements ExecutionService {
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const rawLang = (request.language || "").toLowerCase().trim()
    let lang = rawLang
    if (lang === "c++") lang = "cpp"
    if (lang === "nodejs" || lang === "js") lang = "javascript"
    if (lang === "py" || lang === "python3") lang = "python"

    let result: { stdout: string; stderr: string; compileOutput?: string | null; time: number } = {
      stdout: "",
      stderr: "",
      compileOutput: null,
      time: 0,
    }

    try {
      if (lang === "c") {
        result = await this.executeC(request.code, request.input || "")
      } else if (lang === "cpp") {
        result = await this.executeCpp(request.code, request.input || "")
      } else if (lang === "java") {
        result = await this.executeJava(request.code, request.input || "")
      } else if (lang === "python") {
        result = await this.executePython(request.code, request.input || "")
      } else if (lang === "javascript") {
        result = await this.executeJS(request.code, request.input || "")
      } else {
        result = await this.executePiston(request.language, request.code, request.input || "")
      }
    } catch (err: any) {
      result = {
        stdout: "",
        stderr: err?.message || "Execution exception occurred",
        compileOutput: null,
        time: 0,
      }
    }

    const isCompileError = !!(
      result.compileOutput ||
      (result.stderr && (result.stderr.includes("[Compilation Error") || result.stderr.includes("(Compilation Error)")))
    )
    const isTimeout = !!(result.stderr && result.stderr.includes("Time Limit Exceeded"))
    const isRuntimeError = !isCompileError && !isTimeout && !!result.stderr && result.stderr.trim().length > 0 && !result.stdout

    let verdict: ExecutionVerdict
    let statusId: number

    if (isCompileError) {
      verdict = "Compilation Error"
      statusId = 6
    } else if (isTimeout) {
      verdict = "Time Limit Exceeded"
      statusId = 5
    } else if (isRuntimeError) {
      verdict = "Runtime Error"
      statusId = 11
    } else {
      const isAccepted = matchesExpectedOutput(result.stdout || "", request.expectedOutput || "", request.judgingMode)
      if (isAccepted) {
        verdict = "Accepted"
        statusId = 3
      } else {
        verdict = "Wrong Answer"
        statusId = 4
      }
    }

    const timeInSeconds = Number(((result.time > 50 ? result.time / 1000 : result.time) || 0).toFixed(3))
    const compilerName = lang === "c" ? "GCC" : lang === "cpp" ? "G++" : lang === "java" ? "OpenJDK" : lang.toUpperCase()

    return {
      stdout: result.stdout || null,
      stderr: result.stderr || null,
      compileOutput: result.compileOutput || null,
      time: timeInSeconds,
      memory: null,
      statusId,
      statusDescription: verdict,
      verdict,
      passed: verdict === "Accepted",
      compilerName,
      compilerVersion: "Local Toolchain",
    }
  }

  // ── C (GCC) ────────────────────────────────────────────────────────
  private async executeC(
    code: string,
    input: string
  ): Promise<{ stdout: string; stderr: string; compileOutput?: string | null; time: number }> {
    const start = performance.now()
    const id = randomUUID()
    const tempDirectory = tmpdir()
    const srcFile = join(tempDirectory, `${id}.c`)
    const exeFile = join(tempDirectory, process.platform === "win32" ? `${id}.exe` : `${id}.out`)

    try {
      writeFileSync(srcFile, code, "utf8")

      try {
        execSync(`gcc -O2 "${srcFile}" -o "${exeFile}"`, { stdio: "pipe", timeout: 8000 })
      } catch (compileErr: any) {
        const errorText = (compileErr.stderr?.toString() || compileErr.stdout?.toString() || compileErr.message || "").trim()
        if (compileErr.code === "ENOENT" || errorText.includes("not recognized") || errorText.includes("not found")) {
          return this.executePiston("c", code, input)
        }
        return {
          stdout: "",
          stderr: errorText + "\n[Compilation Error: GCC]",
          compileOutput: errorText,
          time: performance.now() - start,
        }
      }

      return await new Promise((resolve) => {
        const child = exec(`"${exeFile}"`, { timeout: 4000, maxBuffer: 1024 * 1024 * 5 }, (err, stdout, stderr) => {
          let errText = stderr?.toString() || ""
          if (err && err.killed) {
            errText = "Time Limit Exceeded (4.0s timeout)"
          } else if (err && !errText) {
            errText = err.message
          }
          resolve({
            stdout: stdout?.toString() || "",
            stderr: errText,
            compileOutput: null,
            time: performance.now() - start,
          })
        })

        if (input && child.stdin) {
          child.stdin.write(input.endsWith("\n") ? input : input + "\n")
          child.stdin.end()
        } else if (child.stdin) {
          child.stdin.end()
        }
      })
    } finally {
      try { if (existsSync(srcFile)) unlinkSync(srcFile) } catch {}
      try { if (existsSync(exeFile)) unlinkSync(exeFile) } catch {}
    }
  }

  // ── C++ (G++) ──────────────────────────────────────────────────────
  private async executeCpp(
    code: string,
    input: string
  ): Promise<{ stdout: string; stderr: string; compileOutput?: string | null; time: number }> {
    const start = performance.now()
    const id = randomUUID()
    const tempDirectory = tmpdir()
    const srcFile = join(tempDirectory, `${id}.cpp`)
    const exeFile = join(tempDirectory, process.platform === "win32" ? `${id}.exe` : `${id}.out`)

    try {
      writeFileSync(srcFile, code, "utf8")

      try {
        execSync(`g++ -O2 -std=c++17 "${srcFile}" -o "${exeFile}"`, { stdio: "pipe", timeout: 8000 })
      } catch (compileErr: any) {
        const errorText = (compileErr.stderr?.toString() || compileErr.stdout?.toString() || compileErr.message || "").trim()
        if (compileErr.code === "ENOENT" || errorText.includes("not recognized") || errorText.includes("not found")) {
          return this.executePiston("cpp", code, input)
        }
        return {
          stdout: "",
          stderr: errorText + "\n[Compilation Error: G++]",
          compileOutput: errorText,
          time: performance.now() - start,
        }
      }

      return await new Promise((resolve) => {
        const child = exec(`"${exeFile}"`, { timeout: 4000, maxBuffer: 1024 * 1024 * 5 }, (err, stdout, stderr) => {
          let errText = stderr?.toString() || ""
          if (err && err.killed) {
            errText = "Time Limit Exceeded (4.0s timeout)"
          } else if (err && !errText) {
            errText = err.message
          }
          resolve({
            stdout: stdout?.toString() || "",
            stderr: errText,
            compileOutput: null,
            time: performance.now() - start,
          })
        })

        if (input && child.stdin) {
          child.stdin.write(input.endsWith("\n") ? input : input + "\n")
          child.stdin.end()
        } else if (child.stdin) {
          child.stdin.end()
        }
      })
    } finally {
      try { if (existsSync(srcFile)) unlinkSync(srcFile) } catch {}
      try { if (existsSync(exeFile)) unlinkSync(exeFile) } catch {}
    }
  }

  // ── JAVA (OpenJDK) ─────────────────────────────────────────────────
  private async executeJava(
    code: string,
    input: string
  ): Promise<{ stdout: string; stderr: string; compileOutput?: string | null; time: number }> {
    const start = performance.now()
    const id = randomUUID()
    const tempDirectory = tmpdir()
    const runDir = join(tempDirectory, `java_${id}`)

    try {
      mkdirSync(runDir, { recursive: true })

      let className = "Main"
      const match = code.match(/public\s+class\s+([A-Za-z0-9_]+)/)
      if (match) className = match[1]

      const srcFile = join(runDir, `${className}.java`)
      writeFileSync(srcFile, code, "utf8")

      try {
        execSync(`javac "${srcFile}"`, { stdio: "pipe", timeout: 8000, cwd: runDir })
      } catch (compileErr: any) {
        const errorText = (compileErr.stderr?.toString() || compileErr.stdout?.toString() || compileErr.message || "").trim()
        if (compileErr.code === "ENOENT" || errorText.includes("not recognized") || errorText.includes("not found")) {
          return this.executePiston("java", code, input)
        }
        return {
          stdout: "",
          stderr: errorText + "\n[Compilation Error: Java]",
          compileOutput: errorText,
          time: performance.now() - start,
        }
      }

      return await new Promise((resolve) => {
        const child = exec(`java -cp . "${className}"`, { cwd: runDir, timeout: 4000, maxBuffer: 1024 * 1024 * 5 }, (err, stdout, stderr) => {
          let errText = stderr?.toString() || ""
          if (err && err.killed) {
            errText = "Time Limit Exceeded (4.0s timeout)"
          } else if (err && !errText) {
            errText = err.message
          }
          resolve({
            stdout: stdout?.toString() || "",
            stderr: errText,
            compileOutput: null,
            time: performance.now() - start,
          })
        })

        if (input && child.stdin) {
          child.stdin.write(input.endsWith("\n") ? input : input + "\n")
          child.stdin.end()
        } else if (child.stdin) {
          child.stdin.end()
        }
      })
    } catch (e: any) {
      return { stdout: "", stderr: e.message, time: performance.now() - start }
    } finally {
      try {
        if (existsSync(runDir)) {
          rmSync(runDir, { recursive: true, force: true })
        }
      } catch {}
    }
  }

  // ── JAVASCRIPT (V8 VM / Node.js) ───────────────────────────────────
  private async executeJS(code: string, input: string): Promise<{ stdout: string; stderr: string; time: number }> {
    let output = ""
    const start = performance.now()
    try {
      const sandbox = {
        console: {
          log: (...args: any[]) => { output += args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ") + "\n" },
          error: (...args: any[]) => { output += args.join(" ") + "\n" },
          warn: (...args: any[]) => { output += args.join(" ") + "\n" },
        },
        Math, Object, Array, String, Number, Boolean, Date, RegExp, JSON, parseInt, parseFloat
      }

      vm.createContext(sandbox)
      let codeToRun = code

      const funcMatch = code.match(/function\s+([A-Za-z0-9_]+)\s*\(/)
      if (funcMatch && !code.includes(`${funcMatch[1]}(`)) {
        const escapedInput = input ? JSON.stringify(input) : '""'
        codeToRun += `\nconsole.log(${funcMatch[1]}(${escapedInput}));`
      }

      vm.runInContext(codeToRun, sandbox, { timeout: 3000 })
      return { stdout: output, stderr: "", time: performance.now() - start }
    } catch (e: any) {
      return { stdout: output, stderr: e.message, time: performance.now() - start }
    }
  }

  // ── PYTHON ─────────────────────────────────────────────────────────
  private async executePython(code: string, input: string): Promise<{ stdout: string; stderr: string; time: number }> {
    const start = performance.now()
    const id = randomUUID()
    const tempDirectory = tmpdir()
    const file = join(tempDirectory, `${id}.py`)

    try {
      writeFileSync(file, code, "utf8")

      return await new Promise((resolve) => {
        const pyCmd = process.platform === "win32" ? "python" : "python3"
        const child = exec(`${pyCmd} "${file}"`, { timeout: 4000 }, (err, stdout, stderr) => {
          let errText = stderr?.toString() || ""
          if (err && err.killed) {
            errText = "Time Limit Exceeded (4.0s timeout)"
          } else if (err && !errText) {
            errText = err.message
          }
          resolve({
            stdout: stdout?.toString() || "",
            stderr: errText,
            time: performance.now() - start,
          })
        })

        if (input && child.stdin) {
          child.stdin.write(input.endsWith("\n") ? input : input + "\n")
          child.stdin.end()
        } else if (child.stdin) {
          child.stdin.end()
        }
      })
    } catch (e: any) {
      if (e.code === "ENOENT" || e.message?.includes("not recognized") || e.message?.includes("not found")) {
        return this.executePiston("python", code, input)
      }
      return { stdout: "", stderr: e.message, time: performance.now() - start }
    } finally {
      try { if (existsSync(file)) unlinkSync(file) } catch {}
    }
  }

  // ── Remote Cloud Compilers Fallback (Judge0 CE) ────────────────────
  private async executeRemoteCompiler(
    language: string,
    code: string,
    input: string
  ): Promise<{ stdout: string; stderr: string; compileOutput?: string | null; time: number }> {
    const start = performance.now()
    const rawLang = language.toLowerCase().trim()

    const langMap: Record<string, number> = {
      c: 50,          // C (GCC 9.2.0)
      cpp: 54,        // C++ (GCC 9.2.0)
      "c++": 54,
      java: 62,       // Java (OpenJDK 13.0.1)
      python: 71,     // Python (3.8.1)
      py: 71,
      python3: 71,
      javascript: 63, // JavaScript (Node.js 12.14.0)
      js: 63,
      nodejs: 63,
    }

    const languageId = langMap[rawLang] || 50

    try {
      const res = await fetch("https://ce.judge0.com/submissions?wait=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          source_code: code,
          language_id: languageId,
          stdin: input || "",
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const compileOutput = data.compile_output || null
        const stdout = data.stdout || ""
        let stderr = data.stderr || ""

        if (compileOutput) {
          stderr = `${compileOutput}\n[Compilation Error: GCC]`
        } else if (!stderr && data.status && data.status.id > 4 && data.status.id !== 3) {
          stderr = data.status.description || ""
        }

        return {
          stdout,
          stderr: stderr || "",
          compileOutput,
          time: performance.now() - start,
        }
      }
    } catch (e: any) {
      console.warn("[Remote Compiler] Request failed:", e?.message)
    }

    return {
      stdout: "",
      stderr: "Compiler execution unavailable. Local toolchain and cloud compiler failed to respond.",
      compileOutput: null,
      time: performance.now() - start,
    }
  }

  private async executePiston(
    language: string,
    code: string,
    input: string
  ): Promise<{ stdout: string; stderr: string; compileOutput?: string | null; time: number }> {
    return this.executeRemoteCompiler(language, code, input)
  }
}
