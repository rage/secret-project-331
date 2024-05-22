import { mainFrontendClient } from "../mainFrontendClient"

import { ExerciseSlideSubmissionInfo } from "@/shared-module/common/bindings"
import { isExerciseSlideSubmissionInfo } from "@/shared-module/common/bindings.guard"
import { validateResponse } from "@/shared-module/common/utils/fetching"

export const fetchSubmissionInfo = async (
  submissionId: string,
): Promise<ExerciseSlideSubmissionInfo> => {
  const response = await mainFrontendClient.get(`/exercise-slide-submissions/${submissionId}/info`)
  return validateResponse(response, isExerciseSlideSubmissionInfo)
}
