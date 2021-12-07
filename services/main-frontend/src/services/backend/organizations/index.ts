import { Course, CourseCount, Organization } from "../../../shared-module/bindings"
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

export const fetchOrganizationCourses = async (
  organizationId: string,
  page: number,
  limit: number,
): Promise<Array<Course>> => {
  const data = (
    await mainFrontendClient.get(`/organizations/${organizationId}/courses`, {
      responseType: "json",
      params: {
        page,
        limit,
      },
    })
  ).data
  return data
}

export const fetchOrganizationActiveCourses = async (
  organizationId: string,
  page: number,
  limit: number,
): Promise<Array<Course>> => {
  const data = (
    await mainFrontendClient.get(`/organizations/${organizationId}/courses/active`, {
      responseType: "json",
      params: {
        page,
        limit,
      },
    })
  ).data
  return data
}

export const fetchOrganizationCourseCount = async (
  organizationId: string,
): Promise<CourseCount> => {
  const data = (
    await mainFrontendClient.get(`/organizations/${organizationId}/courses/count`, {
      responseType: "json",
    })
  ).data
  return data
}

export const fetchOrganizationActiveCourseCount = async (
  organizationId: string,
): Promise<CourseCount> => {
  const data = (
    await mainFrontendClient.get(`/organizations/${organizationId}/courses/active/count`, {
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
