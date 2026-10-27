import vm from 'vm';
import { exec, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { ExecutionRequest, ExecutionResult, ExecutionService } from "../types"

export class LocalVMExecutionService implements ExecutionService {
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const rawLang = (request.language || "").toLowerCase().trim();
    let lang = rawLang;
    if (lang === 'c++') lang = 'cpp';
    if (lang === 'nodejs' || lang === 'js') lang = 'javascript';
    if (lang === 'py' || lang === 'python3') lang = 'python';

    let result: { stdout: string, stderr: string, compileOutput?: string | null, time: number } = {
      stdout: "",
      stderr: "",
      compileOutput: null,
      time: 0
    };
    
    try {
      if (lang === 'c') {
        result = await this.executeC(request.code, request.input || "");
      } else if (lang === 'cpp') {
        result = await this.executeCpp(request.code, request.input || "");
      } else if (lang === 'java') {
        result = await this.executeJava(request.code, request.input || "");
      } else if (lang === 'python') {
        result = await this.executePython(request.code, request.input || "");
      } else if (lang === 'javascript') {
        result = await this.executeJS(request.code, request.input || "");
      } else {
        // Fallback to Piston for any other requested language
        result = await this.executePiston(request.language, request.code, request.input || "");
      }
    } catch (err: any) {
      result = {
        stdout: "",
        stderr: err?.message || "Execution exception occurred",
        compileOutput: null,
        time: 0
      };
    }

    const cleanExpected = (request.expectedOutput || "").trim().replace(/\r\n/g, "\n");
    const cleanActual = (result.stdout || "").trim().replace(/\r\n/g, "\n");
    
    const isCompileError = !!(result.compileOutput || (result.stderr && result.stderr.includes("(Compilation Error)")));
    const isTimeout = !!(result.stderr && result.stderr.includes("Time Limit Exceeded"));
    const passed = !isCompileError && !isTimeout && (cleanExpected === "" ? (!result.stderr || result.stderr.trim() === "") : (cleanActual === cleanExpected));

    const timeInSeconds = Number(((result.time > 50 ? result.time / 1000 : result.time) || 0).toFixed(3));

    return {
      stdout: result.stdout || null,
      stderr: result.stderr || null,
      compileOutput: result.compileOutput || null,
      time: timeInSeconds,
      memory: 0,
      statusId: isCompileError ? 6 : (isTimeout ? 5 : (passed ? 3 : 4)), // 6 = Compilation Error, 5 = TLE, 3 = Accepted, 4 = Wrong Answer
      passed,
      compilerVersion: lang === "c" ? "GCC" : lang === "cpp" ? "G++" : lang === "java" ? "OpenJDK" : lang.toUpperCase()
    };
  }

  // ── C (GCC) ────────────────────────────────────────────────────────
  private async executeC(code: string, input: string): Promise<{ stdout: string, stderr: string, compileOutput?: string | null, time: number }> {
    const start = performance.now();
    const id = crypto.randomUUID();
    const tmpDir = os.tmpdir();
    const srcFile = path.join(tmpDir, `${id}.c`);
    const exeFile = path.join(tmpDir, process.platform === 'win32' ? `${id}.exe` : `${id}.out`);

    try {
      fs.writeFileSync(srcFile, code, 'utf8');

      // Compile with gcc
      try {
        execSync(`gcc -O2 "${srcFile}" -o "${exeFile}"`, { stdio: 'pipe', timeout: 8000 });
      } catch (compileErr: any) {
        const errorText = (compileErr.stderr?.toString() || compileErr.stdout?.toString() || compileErr.message || "").trim();
        if (compileErr.code === 'ENOENT' || errorText.includes('not recognized') || errorText.includes('not found')) {
          return this.executePiston('c', code, input);
        }
        return {
          stdout: "",
          stderr: errorText + "\n[Compilation Error: GCC]",
          compileOutput: errorText,
          time: performance.now() - start
        };
      }

      // Execute compiled binary
      return await new Promise((resolve) => {
        const child = exec(`"${exeFile}"`, { timeout: 4000, maxBuffer: 1024 * 1024 * 5 }, (err, stdout, stderr) => {
          let errText = stderr?.toString() || "";
          if (err && err.killed) {
            errText = "Time Limit Exceeded (4.0s timeout)";
          } else if (err && !errText) {
            errText = err.message;
          }
          resolve({
            stdout: stdout?.toString() || "",
            stderr: errText,
            compileOutput: null,
            time: performance.now() - start
          });
        });

        if (input && child.stdin) {
          child.stdin.write(input.endsWith("\n") ? input : input + "\n");
          child.stdin.end();
        } else if (child.stdin) {
          child.stdin.end();
        }
      });
    } catch (e: any) {
      if (e.code === 'ENOENT' || e.message?.includes('not recognized') || e.message?.includes('not found')) {
        return this.executePiston('c', code, input);
      }
      return { stdout: "", stderr: e.message, time: performance.now() - start };
    } finally {
      try { if (fs.existsSync(srcFile)) fs.unlinkSync(srcFile); } catch {}
      try { if (fs.existsSync(exeFile)) fs.unlinkSync(exeFile); } catch {}
    }
  }

  // ── C++ (G++) ──────────────────────────────────────────────────────
  private async executeCpp(code: string, input: string): Promise<{ stdout: string, stderr: string, compileOutput?: string | null, time: number }> {
    const start = performance.now();
    const id = crypto.randomUUID();
    const tmpDir = os.tmpdir();
    const srcFile = path.join(tmpDir, `${id}.cpp`);
    const exeFile = path.join(tmpDir, process.platform === 'win32' ? `${id}.exe` : `${id}.out`);

    try {
      fs.writeFileSync(srcFile, code, 'utf8');

      // Compile with g++
      try {
        execSync(`g++ -O2 "${srcFile}" -o "${exeFile}"`, { stdio: 'pipe', timeout: 8000 });
      } catch (compileErr: any) {
        const errorText = (compileErr.stderr?.toString() || compileErr.stdout?.toString() || compileErr.message || "").trim();
        if (compileErr.code === 'ENOENT' || errorText.includes('not recognized') || errorText.includes('not found')) {
          return this.executePiston('c++', code, input);
        }
        return {
          stdout: "",
          stderr: errorText + "\n[Compilation Error: G++]",
          compileOutput: errorText,
          time: performance.now() - start
        };
      }

      // Execute binary
      return await new Promise((resolve) => {
        const child = exec(`"${exeFile}"`, { timeout: 4000, maxBuffer: 1024 * 1024 * 5 }, (err, stdout, stderr) => {
          let errText = stderr?.toString() || "";
          if (err && err.killed) {
            errText = "Time Limit Exceeded (4.0s timeout)";
          } else if (err && !errText) {
            errText = err.message;
          }
          resolve({
            stdout: stdout?.toString() || "",
            stderr: errText,
            compileOutput: null,
            time: performance.now() - start
          });
        });

        if (input && child.stdin) {
          child.stdin.write(input.endsWith("\n") ? input : input + "\n");
          child.stdin.end();
        } else if (child.stdin) {
          child.stdin.end();
        }
      });
    } catch (e: any) {
      if (e.code === 'ENOENT' || e.message?.includes('not recognized') || e.message?.includes('not found')) {
        return this.executePiston('c++', code, input);
      }
      return { stdout: "", stderr: e.message, time: performance.now() - start };
    } finally {
      try { if (fs.existsSync(srcFile)) fs.unlinkSync(srcFile); } catch {}
      try { if (fs.existsSync(exeFile)) fs.unlinkSync(exeFile); } catch {}
    }
  }

  // ── JAVA (OpenJDK) ─────────────────────────────────────────────────
  private async executeJava(code: string, input: string): Promise<{ stdout: string, stderr: string, compileOutput?: string | null, time: number }> {
    const start = performance.now();
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const runDir = path.join(os.tmpdir(), `java_runner_${id}`);

    try {
      if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true });

      // Strip package statement if participant copied it from an external IDE
      const cleanCode = code.replace(/^\s*package\s+[^;]+;\s*/m, "");

      // Determine the main / public class name
      let className = "Main";
      const publicClassMatch = cleanCode.match(/public\s+class\s+([A-Za-z0-9_]+)/);
      const anyClassMatch = cleanCode.match(/class\s+([A-Za-z0-9_]+)/);
      if (publicClassMatch) {
        className = publicClassMatch[1];
      } else if (anyClassMatch) {
        className = anyClassMatch[1];
      }

      const srcFile = path.join(runDir, `${className}.java`);
      fs.writeFileSync(srcFile, cleanCode, 'utf8');

      // Compile with javac
      try {
        execSync(`javac -encoding UTF-8 "${srcFile}"`, { stdio: 'pipe', timeout: 8000 });
      } catch (compileErr: any) {
        const errorText = (compileErr.stderr?.toString() || compileErr.stdout?.toString() || compileErr.message || "").trim();
        if (compileErr.code === 'ENOENT' || errorText.includes('not recognized') || errorText.includes('not found')) {
          return this.executePiston('java', code, input);
        }
        return {
          stdout: "",
          stderr: errorText + "\n[Compilation Error: OpenJDK javac]",
          compileOutput: errorText,
          time: performance.now() - start
        };
      }

      // Execute with java
      return await new Promise((resolve) => {
        const child = exec(`java -Xmx256m -cp "${runDir}" ${className}`, { timeout: 4000, maxBuffer: 1024 * 1024 * 5 }, (err, stdout, stderr) => {
          let errText = stderr?.toString() || "";
          if (err && err.killed) {
            errText = "Time Limit Exceeded (4.0s timeout)";
          } else if (err && !errText) {
            errText = err.message;
          }
          resolve({
            stdout: stdout?.toString() || "",
            stderr: errText,
            compileOutput: null,
            time: performance.now() - start
          });
        });

        if (input && child.stdin) {
          child.stdin.write(input.endsWith("\n") ? input : input + "\n");
          child.stdin.end();
        } else if (child.stdin) {
          child.stdin.end();
        }
      });
    } catch (e: any) {
      if (e.code === 'ENOENT' || e.message?.includes('not recognized') || e.message?.includes('not found')) {
        return this.executePiston('java', code, input);
      }
      return { stdout: "", stderr: e.message, time: performance.now() - start };
    } finally {
      try {
        if (fs.existsSync(runDir)) {
          fs.rmSync(runDir, { recursive: true, force: true });
        }
      } catch {}
    }
  }

  // ── JAVASCRIPT (V8 VM / Node.js) ───────────────────────────────────
  private async executeJS(code: string, input: string): Promise<{ stdout: string, stderr: string, time: number }> {
    let output = "";
    const start = performance.now();
    try {
      const sandbox = {
        console: {
          log: (...args: any[]) => { output += args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" ") + "\n"; },
          error: (...args: any[]) => { output += args.join(" ") + "\n"; },
          warn: (...args: any[]) => { output += args.join(" ") + "\n"; },
        },
        Math, Object, Array, String, Number, Boolean, Date, RegExp, JSON, parseInt, parseFloat
      };
      
      vm.createContext(sandbox);
      let codeToRun = code;
      
      // Auto-invoke solve / function if user didn't write manual calls
      const funcMatch = code.match(/function\s+([A-Za-z0-9_]+)\s*\(/);
      if (funcMatch && !code.includes(`${funcMatch[1]}(`)) {
        const escapedInput = input ? JSON.stringify(input) : '""';
        codeToRun += `\nconsole.log(${funcMatch[1]}(${escapedInput}));`;
      }

      vm.runInContext(codeToRun, sandbox, { timeout: 3000 });
      return { stdout: output, stderr: "", time: performance.now() - start };
    } catch (e: any) {
      return { stdout: output, stderr: e.message, time: performance.now() - start };
    }
  }

  // ── PYTHON ─────────────────────────────────────────────────────────
  private async executePython(code: string, input: string): Promise<{ stdout: string, stderr: string, time: number }> {
    const start = performance.now();
    const id = crypto.randomUUID();
    const tmpDir = os.tmpdir();
    const file = path.join(tmpDir, `${id}.py`);

    try {
      fs.writeFileSync(file, code, 'utf8');

      return await new Promise((resolve) => {
        const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
        const child = exec(`${pyCmd} "${file}"`, { timeout: 4000 }, (err, stdout, stderr) => {
          let errText = stderr?.toString() || "";
          if (err && err.killed) {
            errText = "Time Limit Exceeded (4.0s timeout)";
          } else if (err && !errText) {
            errText = err.message;
          }
          resolve({
            stdout: stdout?.toString() || "",
            stderr: errText,
            time: performance.now() - start
          });
        });

        if (input && child.stdin) {
          child.stdin.write(input.endsWith("\n") ? input : input + "\n");
          child.stdin.end();
        } else if (child.stdin) {
          child.stdin.end();
        }
      });
    } catch (e: any) {
      if (e.code === 'ENOENT' || e.message?.includes('not recognized') || e.message?.includes('not found')) {
        return this.executePiston('python', code, input);
      }
      return { stdout: "", stderr: e.message, time: performance.now() - start };
    } finally {
      try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch {}
    }
  }

  // ── PISTON API (Cloud Well-Known Compilers Fallback) ────────────────
  private async executePiston(language: string, code: string, input: string): Promise<{ stdout: string, stderr: string, compileOutput?: string | null, time: number }> {
    const start = performance.now();
    let lang = language.toLowerCase();
    if (lang === 'cpp') lang = 'c++';

    try {
      const res = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          language: lang,
          version: '*',
          files: [{ content: code }],
          stdin: input || ""
        })
      });

      if (!res.ok) {
        throw new Error(`Piston compiler error: ${res.statusText}`);
      }

      const data = await res.json();
      const run = data.run || {};
      const compile = data.compile || {};

      const compileOutput = compile.output || compile.stderr || null;
      const stdout = run.stdout || (compileOutput ? "" : run.output || "");
      const stderr = compileOutput ? `${compileOutput}\n(Compilation Error)` : (run.stderr || "");

      return {
        stdout,
        stderr,
        compileOutput,
        time: performance.now() - start
      };
    } catch (e: any) {
      return {
        stdout: "",
        stderr: `Compiler execution error: ${e.message}`,
        compileOutput: e.message,
        time: performance.now() - start
      };
    }
  }
}
