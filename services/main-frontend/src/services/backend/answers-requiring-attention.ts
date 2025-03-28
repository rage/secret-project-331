import { mainFrontendClient } from "../mainFrontendClient"

import { AnswersRequiringAttention } from "@/shared-module/common/bindings"
import { isAnswersRequiringAttention } from "@/shared-module/common/bindings.guard"
import { validateResponse } from "@/shared-module/common/utils/fetching"

export const fetchAnswersRequiringAttention = async (
  exerciseId: string,
  page: number,
  limit: number,
): Promise<AnswersRequiringAttention> => {
  const response = await mainFrontendClient.get(
    `/exercises/${exerciseId}/answers-requiring-attention`,
    {
      params: { page, limit },
    },
  )
  return validateResponse(response, isAnswersRequiringAttention)
}
