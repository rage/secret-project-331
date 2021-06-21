import { mainFrontendClient } from "../../mainFrontendClient"
import { Course, Organization } from "../../services.types"

export const fetchOrganizations = async (): Promise<Array<Organization>> => {
  const data = (await mainFrontendClient.get("/organizations", { responseType: "json" })).data
  return data
}

export const fetchOrganizationCourses = async (organizationId: string): Promise<Array<Course>> => {
  const data = (
    await mainFrontendClient.get(`/organizations/${organizationId}/courses`, {
      responseType: "json",
    })
  ).data
  return data
}
