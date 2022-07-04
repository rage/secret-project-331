import { AnswersRequiringAttention } from "../../shared-module/bindings"
import { isAnswersRequiringAttention } from "../../shared-module/bindings.guard"
import { validateResponse } from "../../shared-module/utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

export const fetchAnswersRequiringAttention = async (
  exerciseId: string,
  _page = 1,
): Promise<AnswersRequiringAttention> => {
  const response = await mainFrontendClient.get(
    `/exercises/${exerciseId}/answers-requiring-attention`,
    {
      responseType: "json",
    },
  )

  return validateResponse(response, isAnswersRequiringAttention)
}
