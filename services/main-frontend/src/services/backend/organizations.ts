import { Course, Organization } from "../../shared-module/bindings"
import { isCourse, isOrganization } from "../../shared-module/bindings.guard"
import { isArray, validateResponse } from "../../shared-module/utils/fetching"
import { validateFile } from "../../shared-module/utils/files"
import { mainFrontendClient } from "../mainFrontendClient"

export const fetchOrganizations = async (): Promise<Array<Organization>> => {
  const response = await mainFrontendClient.get("/organizations", { responseType: "json" })
  return validateResponse(response, isArray(isOrganization))
}

export const fetchOrganization = async (organizationId: string): Promise<Organization> => {
  const response = await mainFrontendClient.get(`/organizations/${organizationId}`, {
    responseType: "json",
  })
  return validateResponse(response, isOrganization)
}

export const fetchOrganizationBySlug = async (organizationSlug: string): Promise<Organization> => {
  const res = await mainFrontendClient.get(`/org/${organizationSlug}`, { responseType: "json" })
  return res.data
}

export const fetchOrganizationCourses = async (organizationId: string): Promise<Array<Course>> => {
  const response = await mainFrontendClient.get(`/organizations/${organizationId}/courses`, {
    responseType: "json",
  })
  return validateResponse(response, isArray(isCourse))
}

export const fetchOrganizationCoursesBySlug = async (
  organizationSlug: string,
): Promise<Array<Course>> => {
  const res = await mainFrontendClient.get(`/org/${organizationSlug}/courses`, {
    responseType: "json",
  })
  return res.data
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
  const response = await mainFrontendClient.put(`/organizations/${organizationId}/image`, data)
  return validateResponse(response, isOrganization)
}

export const removeOrganizationImage = async (organizationId: string): Promise<void> => {
  await mainFrontendClient.delete(`/organizations/${organizationId}/image`)
}
