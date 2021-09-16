import { Course, Organization } from "../../../shared-module/bindings"
import { validateFile } from "../../../shared-module/utils/files"
import { mainFrontendClient } from "../../mainFrontendClient"

export const fetchOrganizations = async (): Promise<Array<Organization>> => {
  const data = (await mainFrontendClient.get("/organizations", { responseType: "json" })).data
  return data
}

export const fetchOrganization = async (organizationId: string): Promise<Organization> => {
  const data = (
    await mainFrontendClient.get(`/organizations/${organizationId}`, { responseType: "json" })
  ).data
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

export const setOrganizationImage = async (
  organizationId: string,
  file: File,
): Promise<Organization> => {
  validateFile(file, ["image"])
  const data = new FormData()
  data.append("file", file, file.name || "unknown")
  const res = await mainFrontendClient.put(`/organizations/${organizationId}/image`, data)
  return res.data
}

export const removeOrganizationImage = async (organizationId: string): Promise<void> => {
  const res = await mainFrontendClient.delete(`/organizations/${organizationId}/image`)
  return res.data
}
