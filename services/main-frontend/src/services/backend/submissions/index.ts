import { SubmissionInfo } from "../../../shared-module/bindings"
import { mainFrontendClient } from "../../mainFrontendClient"

export const fetchSubmissionInfo = async (submissionId: string): Promise<SubmissionInfo> => {
  const data = (
    await mainFrontendClient.get(`/submissions/${submissionId}/info`, {
      responseType: "json",
    })
  ).data
  return data
}
