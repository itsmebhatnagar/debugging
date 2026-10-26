export interface ExecutionRequest {
  language: string
  code: string
  input: string
  expectedOutput: string
}

export type ExecutionVerdict =
  | "Accepted"
  | "Wrong Answer"
  | "Compilation Error"
  | "Runtime Error"
  | "Time Limit Exceeded"
  | "Internal Error"

export interface ExecutionResult {
  stdout: string | null
  stderr: string | null
  compileOutput: string | null
  time: number | null // in seconds
  memory: number | null // in KB
  statusId: number // Judge0 standard status IDs (3 = Accepted, 4 = Wrong Answer, etc)
  statusDescription: ExecutionVerdict
  verdict: ExecutionVerdict
  passed: boolean
  compilerName?: string
  compilerVersion?: string
}

export interface ExecutionService {
  execute(request: ExecutionRequest): Promise<ExecutionResult>
}
