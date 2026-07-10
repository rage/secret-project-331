import { jsonRoute } from "@/lib/apiRoutes"
import { readSpecRequestAlternatives } from "@/server/specRequest"
import { PublicAlternative } from "@/util/stateInterfaces"

// The public spec is what the student's browser is allowed to see. We derive it from the private
// spec by dropping the `correct` flag so the answers don't leak to the client.
export const handlePublicSpec = jsonRoute(async (request) => {
  const alternatives = await readSpecRequestAlternatives(request)
  const publicSpec = alternatives.map<PublicAlternative>((alternative) => ({
    id: alternative.id,
    name: alternative.name,
  }))
  return Response.json(publicSpec)
})
