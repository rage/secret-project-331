import axios from "axios"
import { DateTimeToISOString, ISOStringToDateTime } from "../../../utils/dateUtil"
import { Course, Organization } from "../../services.types"

const mainFrontendOrganizationsClient = axios.create({
  baseURL: "/api/v0/main-frontend/organizations",
})

mainFrontendOrganizationsClient.interceptors.response.use(
  (response) => {
    ISOStringToDateTime(response.data)
    return response
  },
  (err) => console.error(err),
)

mainFrontendOrganizationsClient.interceptors.request.use(
  (data) => {
    DateTimeToISOString(data)
    return data
  },
  (err) => console.error(err),
)

export const fetchOrganizations = async (): Promise<Array<Organization>> => {
  const url = `/api/v0/main-frontend/organizations`
  const data = (await mainFrontendOrganizationsClient.get("", { responseType: "json" })).data
  return data
}

export const fetchOrganizationCourses = async (organizationId: string): Promise<Array<Course>> => {
  const urls = `/api/v0/main-frontend/organizations/${organizationId}/courses`
  const data = (
    await mainFrontendOrganizationsClient.get(`/${organizationId}/courses`, {
      responseType: "json",
    })
  ).data
  return data
}
