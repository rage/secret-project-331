import { mainFrontendClient } from "../../mainFrontendClient"
import { SubmissionInfo } from "../../services.types"

export const fetchSubmissionInfo = async (submissionId: string): Promise<SubmissionInfo> => {
  const data = (
    await mainFrontendClient.get(`/submissions/${submissionId}/info`, {
      responseType: "json",
    })
  ).data
  return data
}
