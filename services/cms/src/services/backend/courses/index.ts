import { CourseOverview } from "../../services.types"
import { cmsClient } from "../cmsClient"

export const fetchCourseStructure = async (courseId: string): Promise<CourseOverview> => {
  const data = (await cmsClient.get(`/courses/${courseId}/structure`, { responseType: "json" }))
    .data
  return data
}

export const fetchCourseInstanceEmailTemplates = async (courseInstanceId: string): Promise<any> => {
  return (
    await cmsClient.get(`/course-instances/${courseInstanceId}/email-templates`, {
      responseType: "json",
    })
  ).data
}
