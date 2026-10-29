import { ExecutionRequest, ExecutionResult, ExecutionService } from "./types"
import { DockerExecutionService } from "./providers/docker"
import { Judge0ExecutionService } from "./providers/judge0"
import { LocalVMExecutionService } from "./providers/local-vm"

class FallbackExecutionService implements ExecutionService {
  private dockerService = new DockerExecutionService()
  private localService = new LocalVMExecutionService()

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    try {
      return await this.dockerService.execute(request)
    } catch (dockerErr: any) {
      const msg = dockerErr?.message || ""
      
      // If the error is a user request validation failure (e.g. empty code, exceeded limits), rethrow
      if (
        msg.includes("Invalid execution request") ||
        msg.includes("Source code cannot be empty") ||
        msg.includes("Source code exceeds") ||
        msg.includes("Program input exceeds") ||
        msg.includes("Expected output exceeds")
      ) {
        throw dockerErr
      }

      console.warn(`[Execution] Docker execution unavailable (${msg.slice(0, 150)}). Falling back to Local/Cloud execution.`)
      return await this.localService.execute(request)
    }
  }
}

export function getExecutionService(): ExecutionService {
  const provider = (process.env.EXECUTION_PROVIDER || "").toLowerCase().trim()
  if (provider === "judge0") {
    return new Judge0ExecutionService()
  }
  if (provider === "local" || provider === "local_vm" || provider === "local-vm") {
    return new LocalVMExecutionService()
  }
  if (provider === "docker") {
    return new DockerExecutionService()
  }
  return new FallbackExecutionService()
}

export { DockerExecutionService, Judge0ExecutionService, LocalVMExecutionService }
