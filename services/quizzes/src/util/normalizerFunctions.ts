import { denormalize, normalize } from "normalizr"

import { Entities, Quiz } from "../../types/types"
import { normalizedQuiz } from "../schemas"
import { StoreState } from "../store/store"

export const normalizeData = (data: Quiz) => {
  const normalizedInputData = normalize(data, normalizedQuiz)
  return {
    quizzes: normalizedInputData.entities.quizzes ?? {},
    items: normalizedInputData.entities.items ?? {},
    options: normalizedInputData.entities.options ?? {},
    result: normalizedInputData.result ?? "",
    peerReviewCollections: normalizedInputData.entities.peerReviewCollections ?? {},
    questions: normalizedInputData.entities.questions ?? {},
  }
}

export const denormalizeData = (state: StoreState) => {
  const entities: Entities = {
    quizzes: state.editor.quizzes,
    items: state.editor.items,
    result: state.editor.quizId,
    options: state.editor.options,
  }
  const res = denormalize(state.editor.quizId, normalizedQuiz, entities)
  return res
}
