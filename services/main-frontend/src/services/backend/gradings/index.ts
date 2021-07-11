import { mainFrontendClient } from "../../mainFrontendClient"
import { Grading } from "../../services.types"

export const fetchGrading = async (gradingId: string): Promise<Grading> => {
  const data = (
    await mainFrontendClient.get(`/gradings/${gradingId}`, {
      responseType: "json",
    })
  ).data
  return data
}
