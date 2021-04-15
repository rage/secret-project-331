import axios from "axios"

export interface Course {
  id: string
  created_at: string
  updated_at: string
  name: string
  deleted: boolean
}

export const fetchCourses = async (): Promise<Array<Course>> => {
  const data = (await axios.get("/api/v0/courses", { responseType: "json" })).data
  return data
}

export interface Organization {
  id: string
  created_at: string
  updated_at: string
  name: string
  deleted: boolean
}

export const fetchOrganizations = async (): Promise<Array<Organization>> => {
  const data = (await axios.get("/api/v0/organizations", { responseType: "json" })).data
  return data
}

export const fetchOrganizationCourses = async (
  organizationId: string,
): Promise<Array<Organization>> => {
  const data = (
    await axios.get(`/api/v0/organizations/${organizationId}/courses`, { responseType: "json" })
  ).data
  return data
}

export interface CoursePage {
  id: string
  created_at: Date
  updated_at: Date
  course_id: string
  content: Block<unknown>[]
  url_path: string
  title: string
  deleted: boolean
}

export interface Block<T> {
  name: string
  isValid: boolean
  clientId: string
  attributes: T
  innerBlocks: any[]
}

export const fetchCoursePageByPath = async (
  courseId: string,
  path: string,
): Promise<CoursePage> => {
  const data = (
    await axios.get(`/api/v0/courses/${courseId}/page-by-path/${path}`, { responseType: "json" })
  ).data
  return data
}
