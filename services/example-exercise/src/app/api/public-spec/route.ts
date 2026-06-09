import { NextResponse } from "next/server"

import { BadRequestError, jsonRoute, readJsonBody } from "@/lib/apiRoutes"
import { isSpecRequest, SpecRequest } from "@/util/exerciseServiceApi"
import { Alternative, PublicAlternative } from "@/util/stateInterfaces"

// The public spec is what the student's browser is allowed to see. We derive it from the private
// spec by dropping the `correct` flag so the answers don't leak to the client.
function toPublicSpec(specRequest: SpecRequest): NextResponse<PublicAlternative[]> {
  const privateSpec = specRequest.private_spec
  if (!Array.isArray(privateSpec)) {
    throw new BadRequestError("private_spec must be an array of alternatives")
  }
  const publicSpec = (privateSpec as Alternative[]).map<PublicAlternative>((alternative) => ({
    id: alternative.id,
    name: alternative.name,
  }))
  return NextResponse.json(publicSpec)
}

export const POST = jsonRoute(async (request) => {
  const body = await readJsonBody(request)
  if (!isSpecRequest(body)) {
    throw new BadRequestError("Request was not valid.")
  }
  return toPublicSpec(body)
})
