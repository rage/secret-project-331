import { mainFrontendClient } from "../../mainFrontendClient"
import { Submission } from "../../services.types"

export const fetchSubmission = async (submissionId: string): Promise<Submission> => {
  const data = (
    await mainFrontendClient.get(`/submissions/${submissionId}`, {
      responseType: "json",
    })
  ).data
  return data
}
