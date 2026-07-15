import { jsonRoute } from "@/lib/apiRoutes"
import { assertNoLeak } from "@/server/leakGuard"
import { readSpecRequestAlternatives } from "@/server/specRequest"
import { toVersionedModelSolution, type VersionedModelSolution } from "@/util/stateInterfaces"

export const handleModelSolution = jsonRoute(async (request) => {
  const alternatives = await readSpecRequestAlternatives(request)
  const correctOptionIds = alternatives
    .filter((alternative) => alternative.correct)
    .map((alternative) => alternative.id)
  const modelSolution: VersionedModelSolution = toVersionedModelSolution(correctOptionIds)
  // The model solution reveals ONLY which ids are correct. Fail closed if it ever also carries the
  // `correct`/`name` keys, an option name, or an incorrect-option id — those would tell the student
  // the full answer set / labels, not just the key. Values that legitimately appear (the correct ids
  // themselves) are excluded so a name/id coincidence can't trip a false positive.
  const forbiddenValues = [
    ...alternatives.map((alternative) => alternative.name),
    ...alternatives
      .filter((alternative) => !alternative.correct)
      .map((alternative) => alternative.id),
  ].filter((value) => !correctOptionIds.includes(value))
  assertNoLeak(modelSolution, { forbiddenKeys: ["correct", "name"], forbiddenValues })
  return Response.json(modelSolution)
})
