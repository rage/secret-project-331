import axios from "axios"
import { Course, Organization } from "../../services.types"

export const fetchOrganizations = async (): Promise<Array<Organization>> => {
  const url = `/api/v0/main-frontend/organizations`
  const data = (await axios.get(url, { responseType: "json" })).data
  return data
}

export const fetchOrganizationCourses = async (organizationId: string): Promise<Array<Course>> => {
  const data = (
    await axios.get(`/api/v0/main-frontend/organizations/${organizationId}/courses`, {
      responseType: "json",
    })
  ).data
  return data
}
