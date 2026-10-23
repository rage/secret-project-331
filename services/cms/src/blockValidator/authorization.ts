import { createHash, timingSafeEqual } from "crypto"

const digest = (value: string): Buffer => createHash("sha256").update(value).digest()

/**
 * Whether an Authorization header carries the shared agent validator secret. Fails closed when the
 * secret isn't configured.
 */
export const hasAgentValidatorSecret = (
  authorizationHeader: string | undefined,
  secret: string | undefined = process.env.AGENT_VALIDATOR_SECRET,
): boolean => {
  if (!secret || !authorizationHeader?.startsWith("Bearer ")) {
    return false
  }
  return timingSafeEqual(digest(authorizationHeader.slice("Bearer ".length)), digest(secret))
}
