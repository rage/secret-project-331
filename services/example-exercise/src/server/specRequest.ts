import { BadRequestError, readJsonBody } from "@/lib/apiRoutes"
import { parseSpecArrayStrict } from "@/server/csvExportUtils"
import { isSpecRequest } from "@/util/exerciseServiceApi"
import { migratePrivateSpecToLatest } from "@/util/migration/migrateToLatest"
import { isAlternative, type Alternative } from "@/util/stateInterfaces"

/**
 * Reads a spec request and returns its private spec as an `Alternative[]`, migrated to the latest
 * version. Throws `BadRequestError` for an invalid spec request or a malformed option and
 * `MalformedBlobError` for an unreadable private spec, both answered with `400` by `jsonRoute`.
 * Shared by the public-spec and model-solution handlers.
 */
export async function readSpecRequestAlternatives(request: Request): Promise<Alternative[]> {
  const body = await readJsonBody(request)
  if (!isSpecRequest(body)) {
    throw new BadRequestError("Request was not valid.")
  }
  return parseSpecArrayStrict(migratePrivateSpecToLatest(body.private_spec), isAlternative)
}
