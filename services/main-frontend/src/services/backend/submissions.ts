import { ExerciseSlideSubmissionInfo } from "../../shared-module/bindings"
import { isExerciseSlideSubmissionInfo } from "../../shared-module/bindings.guard"
import { validateResponse } from "../../shared-module/utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

export const fetchSubmissionInfo = async (
  submissionId: string,
): Promise<ExerciseSlideSubmissionInfo> => {
  const response = await mainFrontendClient.get(
    `/exercise-slide-submissions/${submissionId}/info`,
    {
      responseType: "json",
    },
  )
  return validateResponse(response, isExerciseSlideSubmissionInfo)
}
