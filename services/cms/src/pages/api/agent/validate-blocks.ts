import { agentValidatorRoute } from "@/blockValidator/agentValidatorRoute"
import { callBlockValidator } from "@/blockValidator/validatorWorker"

// Twice MAX_REQUEST_BYTES (validateBlocks.ts); Next needs a literal here.
export const config = { api: { bodyParser: { sizeLimit: "2mb" } } }

export default agentValidatorRoute("POST", (req, clientTimeoutMs) =>
  callBlockValidator({ kind: "validate", body: req.body }, clientTimeoutMs),
)
