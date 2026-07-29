import { BadRequestError, readJsonBody } from "@/lib/apiRoutes"
import { isSpecRequest } from "@/util/exerciseServiceApi"
import { migratePrivateSpecToLatest } from "@/util/migration/migrateToLatest"
import type { Alternative } from "@/util/stateInterfaces"

/**
 * Reads a spec request and returns its private spec as an `Alternative[]`, migrated to the latest
 * version. Throws `BadRequestError` if the body is not a valid spec request or the private spec is
 * an unrecognizable shape. Shared by the public-spec and model-solution handlers.
 */
export async function readSpecRequestAlternatives(request: Request): Promise<Alternative[]> {
  const body = await readJsonBody(request)
  if (!isSpecRequest(body)) {
    throw new BadRequestError("Request was not valid.")
  }
  const alternatives = migratePrivateSpecToLatest(body.private_spec)
  if (alternatives === null) {
    throw new BadRequestError("private_spec must be alternatives or a versioned envelope")
  }
  return alternatives
}
