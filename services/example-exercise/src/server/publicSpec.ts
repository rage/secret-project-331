import { BadRequestError, jsonRoute, readJsonBody } from "@/lib/apiRoutes"
import { assertNoLeak } from "@/server/leakGuard"
import { isSpecRequest, SpecRequest } from "@/util/exerciseServiceApi"
import { alternativesFromStored, PublicAlternative } from "@/util/stateInterfaces"

// The public spec is what the student's browser is allowed to see. We derive it from the private
// spec with an allowlist projection (id + name only) so the `correct` flag never reaches the client.
function toPublicSpec(specRequest: SpecRequest): Response {
  // migrate-on-read: accept the legacy bare array and the versioned envelope.
  const alternatives = alternativesFromStored(specRequest.private_spec)
  if (alternatives === null) {
    throw new BadRequestError("private_spec must be alternatives or a versioned envelope")
  }
  const publicSpec = alternatives.map<PublicAlternative>((alternative) => ({
    id: alternative.id,
    name: alternative.name,
  }))
  // Fail closed before serving: never ship the `correct` key, and never let an answer-revealing
  // string survive. This MC public spec has no secret *strings* (option ids and names are public;
  // correctness is a boolean caught by the key guard), so `forbiddenValues` is empty — a richer
  // exercise would list solution text, validator regexes, etc. here.
  assertNoLeak(publicSpec, { forbiddenKeys: ["correct"], forbiddenValues: [] })
  return Response.json(publicSpec)
}

export const handlePublicSpec = jsonRoute(async (request) => {
  const body = await readJsonBody(request)
  if (!isSpecRequest(body)) {
    throw new BadRequestError("Request was not valid.")
  }
  return toPublicSpec(body)
})
