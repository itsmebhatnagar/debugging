import { ExecutionService } from "./types"
import { DockerExecutionService } from "./providers/docker"

export function getExecutionService(): ExecutionService {
  return new DockerExecutionService()
}
  
