import { Course, Organization } from "../../shared-module/bindings"
import { isOrganization } from "../../shared-module/bindings.guard"
import { validateFile } from "../../shared-module/utils/files"
import { isArray, validateResponse } from "../../utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

export const fetchOrganizations = async (): Promise<Array<Organization>> => {
  const response = await mainFrontendClient.get("/organizations", { responseType: "json" })
  const data = validateResponse(response, isArray(isOrganization))
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
  // eslint-disable-next-line i18next/no-literal-string
  validateFile(file, ["image"])
  const data = new FormData()
  // eslint-disable-next-line i18next/no-literal-string
  data.append("file", file, file.name || "unknown")
  const res = await mainFrontendClient.put(`/organizations/${organizationId}/image`, data)
  return res.data
}

export const removeOrganizationImage = async (organizationId: string): Promise<void> => {
  const res = await mainFrontendClient.delete(`/organizations/${organizationId}/image`)
  return res.data
}
