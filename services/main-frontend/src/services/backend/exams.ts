import { Exam } from "../../shared-module/bindings"
import { mainFrontendClient } from "../mainFrontendClient"

export const fetchOrganizationExams = async (organizationId: string): Promise<Array<Exam>> => {
  const data = (
    await mainFrontendClient.get(`/organizations/${organizationId}/exams`, { responseType: "json" })
  ).data
  return data
}
