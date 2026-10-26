export interface ExecutionRequest {
  language: string
  code: string
  input: string
  expectedOutput: string
  judgingMode?: "line" | "token" | "exact"
}

export type ExecutionVerdict =
  | "Accepted"
  | "Wrong Answer"
  | "Compilation Error"
  | "Runtime Error"
  | "Time Limit Exceeded"
  | "Memory Limit Exceeded"
  | "Output Limit Exceeded"
  | "Internal Error"

export interface ExecutionResult {
  stdout: string | null
  stderr: string | null
  compileOutput: string | null
  time: number | null // in seconds
  memory: number | null // in KB
  statusId: number // Standardized judge status IDs (3 = Accepted, 4 = Wrong Answer, etc)
  statusDescription: ExecutionVerdict
  verdict: ExecutionVerdict
  passed: boolean
  compilerName?: string
  compilerVersion?: string
}

export interface ExecutionService {
  execute(request: ExecutionRequest): Promise<ExecutionResult>
}
