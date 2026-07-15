import { BadRequestError, jsonRoute, readJsonBody } from "@/lib/apiRoutes"
import { assertNoLeak } from "@/server/leakGuard"
import { isSpecRequest, SpecRequest } from "@/util/exerciseServiceApi"
import {
  alternativesFromStored,
  toVersionedModelSolution,
  VersionedModelSolution,
} from "@/util/stateInterfaces"

function toModelSolution(specRequest: SpecRequest): Response {
  // migrate-on-read: accept the legacy bare array and the versioned envelope.
  const alternatives = alternativesFromStored(specRequest.private_spec)
  if (alternatives === null) {
    throw new BadRequestError("private_spec must be alternatives or a versioned envelope")
  }
  const correctOptionIds = alternatives
    .filter((alternative) => alternative.correct)
    .map((a) => a.id)
  const modelSolution: VersionedModelSolution = toVersionedModelSolution(correctOptionIds)
  // The model solution reveals ONLY which ids are correct. Fail closed if it ever also carries the
  // `correct`/`name` keys, an option name, or an incorrect-option id — those would tell the student
  // the full answer set / labels, not just the key. This is the value dimension in action. Values
  // that legitimately appear (the correct ids themselves) are excluded so a name/id coincidence
  // can't trip a false positive.
  const forbiddenValues = [
    ...alternatives.map((alternative) => alternative.name),
    ...alternatives.filter((alternative) => !alternative.correct).map((a) => a.id),
  ].filter((value) => !correctOptionIds.includes(value))
  assertNoLeak(modelSolution, { forbiddenKeys: ["correct", "name"], forbiddenValues })
  return Response.json(modelSolution)
}

export const handleModelSolution = jsonRoute(async (request) => {
  const body = await readJsonBody(request)
  if (!isSpecRequest(body)) {
    throw new BadRequestError("Request was not valid.")
  }
  return toModelSolution(body)
})
