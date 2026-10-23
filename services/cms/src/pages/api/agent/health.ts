import { agentValidatorRoute } from "@/blockValidator/agentValidatorRoute"
import { isBlockValidatorReady, startBlockValidator } from "@/blockValidator/validatorWorker"

export default agentValidatorRoute("GET", () => {
  startBlockValidator()
  return Promise.resolve(
    isBlockValidatorReady()
      ? { status: 200, body: { status: "ready" } }
      : { status: 503, body: { status: "starting", retryable: true } },
  )
})
