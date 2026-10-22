import { ExecutionService } from "./types"
import { Judge0ExecutionService } from "./providers/judge0"

export function getExecutionService(): ExecutionService {
  return new Judge0ExecutionService()
}
  
