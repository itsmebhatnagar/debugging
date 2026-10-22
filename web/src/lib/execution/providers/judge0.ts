import { assertSupportedLanguage } from "../../code-language"
import { ExecutionRequest, ExecutionResult, ExecutionService } from "../types"

interface Judge0Language {
  id: number
  name: string
}

interface Judge0Submission {
  stdout: string | null
  stderr: string | null
  compile_output: string | null
  time: string | null
  memory: number | null
  status?: { id: number; description: string }
}

export class Judge0ExecutionService implements ExecutionService {
  private readonly apiUrl: string

  constructor() {
    this.apiUrl = (process.env.JUDGE0_API_URL || "http://localhost:2358").replace(/\/+$/, "")
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    assertSupportedLanguage(request.language)

    const compiler = await this.getLatestCCompiler()
    const response = await fetch(`${this.apiUrl}/submissions?wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        source_code: request.code,
        language_id: compiler.id,
        stdin: request.input,
        expected_output: request.expectedOutput,
        cpu_time_limit: 2,
        cpu_extra_time: 1,
        wall_time_limit: 5,
        memory_limit: 128000,
        enable_network: false,
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`Judge0 submission failed (${response.status}): ${detail}`)
    }

    const data = (await response.json()) as Judge0Submission
    const statusId = data.status?.id ?? 0

    return {
      stdout: data.stdout,
      stderr: data.stderr,
      compileOutput: data.compile_output,
      time: Number.parseFloat(data.time || "0"),
      memory: data.memory ?? 0,
      statusId,
      passed: statusId === 3,
      compilerVersion: compiler.version,
    }
  }

  private async getLatestCCompiler(): Promise<{ id: number; version: string }> {
    const response = await fetch(`${this.apiUrl}/languages`, {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    })

    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`Could not load Judge0 compiler versions (${response.status}): ${detail}`)
    }

    const languages = (await response.json()) as Judge0Language[]
    const compilers = languages
      .map((language) => {
        const match = language.name.match(/^C \(GCC ([^)]+)\)$/i)
        return match ? { id: language.id, version: match[1] } : null
      })
      .filter((compiler): compiler is { id: number; version: string } => compiler !== null)
      .sort((left, right) => compareVersions(right.version, left.version))

    const latest = compilers[0]
    if (!latest) {
      throw new Error("The configured Judge0 instance does not offer a GCC C compiler.")
    }

    return latest
  }
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
