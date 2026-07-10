import { jsonRoute } from "@/lib/apiRoutes"
import { readSpecRequestAlternatives } from "@/server/specRequest"
import { ModelSolutionApi } from "@/util/stateInterfaces"

export const handleModelSolution = jsonRoute(async (request) => {
  const alternatives = await readSpecRequestAlternatives(request)
  const modelSolution: ModelSolutionApi = {
    correctOptionIds: alternatives
      .filter((alternative) => alternative.correct)
      .map((alternative) => alternative.id),
  }
  return Response.json(modelSolution)
})
