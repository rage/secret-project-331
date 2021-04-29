import axios from "axios"
import { Organization } from "../../services.types"

const fetchOrganizations = async (): Promise<Array<Organization>> => {
  const url = `/api/v0/cms/organizations`
  try {
    const data = (await axios.get(url, { responseType: "json" })).data
    console.log(data)
    return data
  } catch (error) {
    console.log(error)
  }
}

const fetchOrganizationCourses = async (organizationId: string): Promise<Array<Organization>> => {
  const data = (
    await axios.get(`/api/v0/cms/organizations/${organizationId}/courses`, {
      responseType: "json",
    })
  ).data
  return data
}

export { fetchOrganizations, fetchOrganizationCourses }
