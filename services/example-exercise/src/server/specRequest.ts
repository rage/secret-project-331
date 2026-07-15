import { BadRequestError, readJsonBody } from "@/lib/apiRoutes"
import { isSpecRequest } from "@/util/exerciseServiceApi"
import { alternativesFromStored, type Alternative } from "@/util/stateInterfaces"

/**
 * Reads a spec request from the incoming request and returns its private spec as an
 * `Alternative[]`. Throws `BadRequestError` if the body is not a valid spec request or the private
 * spec is neither a bare `Alternative[]` nor a versioned envelope. Shared by the public-spec and
 * model-solution handlers.
 */
export async function readSpecRequestAlternatives(request: Request): Promise<Alternative[]> {
  const body = await readJsonBody(request)
  if (!isSpecRequest(body)) {
    throw new BadRequestError("Request was not valid.")
  }
  // migrate-on-read: accept the legacy bare `Alternative[]` and the versioned `{ version, alternatives }` envelope.
  const alternatives = alternativesFromStored(body.private_spec)
  if (alternatives === null) {
    throw new BadRequestError("private_spec must be alternatives or a versioned envelope")
  }
  return alternatives
}
