import { CourseStructure } from "../../../shared-module/bindings"
import { cmsClient } from "../cmsClient"

export const fetchCourseStructure = async (courseId: string): Promise<CourseStructure> => {
  const data = (await cmsClient.get(`/courses/${courseId}/structure`, { responseType: "json" }))
    .data
  return data
}
