import { CourseOverview } from "../../services.types"
import { cmsClient } from "../cmsClient"

export const fetchCourseStructure = async (courseId: string): Promise<CourseOverview> => {
  const data = (await cmsClient.get(`/courses/${courseId}/structure`, { responseType: "json" }))
    .data
  return data
}
