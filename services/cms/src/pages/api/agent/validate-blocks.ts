import { agentValidatorRoute } from "@/blockValidator/agentValidatorRoute"
import { callBlockValidator } from "@/blockValidator/validatorWorker"

export const config = { api: { bodyParser: { sizeLimit: "20mb" } } }

export default agentValidatorRoute("POST", (req) =>
  callBlockValidator({ kind: "validate", body: req.body }),
)
