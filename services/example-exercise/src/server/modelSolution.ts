import { BadRequestError, jsonRoute, readJsonBody } from "@/lib/apiRoutes"
import { isSpecRequest, SpecRequest } from "@/util/exerciseServiceApi"
import { Alternative, ModelSolutionApi } from "@/util/stateInterfaces"

function toModelSolution(specRequest: SpecRequest): Response {
  const privateSpec = specRequest.private_spec
  if (!Array.isArray(privateSpec)) {
    throw new BadRequestError("private_spec must be an array of alternatives")
  }
  const modelSolution: ModelSolutionApi = {
    correctOptionIds: (privateSpec as Alternative[])
      .filter((alternative) => alternative.correct)
      .map((alternative) => alternative.id),
  }
  return Response.json(modelSolution)
}

export const handleModelSolution = jsonRoute(async (request) => {
  const body = await readJsonBody(request)
  if (!isSpecRequest(body)) {
    throw new BadRequestError("Request was not valid.")
  }
  return toModelSolution(body)
})
