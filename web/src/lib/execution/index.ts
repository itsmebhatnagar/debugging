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
      const isDockerInfraError =
        msg.includes("Cannot connect to the Docker daemon") ||
        msg.includes("docker API") ||
        msg.includes("dockerDesktopLinuxEngine") ||
        msg.includes("ENOENT") ||
        msg.includes("spawn docker ENOENT") ||
        msg.includes("The system cannot find the file specified") ||
        msg.includes("docker daemon") ||
        msg.includes("is the docker daemon running") ||
        msg.includes("Docker daemon is not running") ||
        msg.includes("container creation failed")

      if (isDockerInfraError) {
        console.warn(`Docker execution unavailable (${msg.slice(0, 120)}). Falling back to Local execution.`)
        return await this.localService.execute(request)
      }
      throw dockerErr
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
