import { agentValidatorRoute } from "@/blockValidator/agentValidatorRoute"
import { callBlockValidator } from "@/blockValidator/validatorWorker"

export default agentValidatorRoute("GET", () => callBlockValidator({ kind: "block-schemas" }))
