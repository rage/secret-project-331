import { BadRequestError, readJsonBody } from "@/lib/apiRoutes"
import { isSpecRequest } from "@/util/exerciseServiceApi"
import type { Alternative } from "@/util/stateInterfaces"

/**
 * Reads a spec request from the incoming request and returns its private spec as an
 * `Alternative[]`. Throws `BadRequestError` if the body is not a valid spec request or the private
 * spec is not an array of alternatives. Shared by the public-spec and model-solution handlers.
 */
export async function readSpecRequestAlternatives(request: Request): Promise<Alternative[]> {
  const body = await readJsonBody(request)
  if (!isSpecRequest(body)) {
    throw new BadRequestError("Request was not valid.")
  }
  const privateSpec = body.private_spec
  if (!Array.isArray(privateSpec)) {
    throw new BadRequestError("private_spec must be an array of alternatives")
  }
  return privateSpec as Alternative[]
}
