import { SubmissionInfo } from "../../shared-module/bindings"
import { isSubmissionInfo } from "../../shared-module/bindings.guard"
import { validateResponse } from "../../shared-module/utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

export const fetchSubmissionInfo = async (submissionId: string): Promise<SubmissionInfo> => {
  const response = await mainFrontendClient.get(`/submissions/${submissionId}/info`, {
    responseType: "json",
  })
  return validateResponse(response, isSubmissionInfo)
}
