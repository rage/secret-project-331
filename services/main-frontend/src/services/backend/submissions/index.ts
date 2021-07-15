import { mainFrontendClient } from "../../mainFrontendClient"
import { Submission, SubmissionInfo } from "../../services.types"

export const fetchSubmission = async (submissionId: string): Promise<Submission> => {
  const data = (
    await mainFrontendClient.get(`/submissions/${submissionId}`, {
      responseType: "json",
    })
  ).data
  return data
}

export const fetchSubmissionInfo = async (submissionId: string): Promise<SubmissionInfo> => {
  const data = (
    await mainFrontendClient.get(`/submissions/${submissionId}/info`, {
      responseType: "json",
    })
  ).data
  return data
}
