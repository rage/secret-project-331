import { agentValidatorRoute } from "@/blockValidator/agentValidatorRoute"
import { callBlockValidator } from "@/blockValidator/validatorWorker"

export default agentValidatorRoute("GET", (_req, clientTimeoutMs) =>
  callBlockValidator({ kind: "block-schemas" }, clientTimeoutMs),
)
