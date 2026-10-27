import { ExecutionService } from "./types"
import { LocalVMExecutionService } from "./providers/local-vm"

export function getExecutionService(): ExecutionService {
  return new LocalVMExecutionService()
}
