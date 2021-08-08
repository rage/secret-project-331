import { CourseInstance } from "../../../shared-module/bindings"
import { cmsClient } from "../cmsClient"

export const fetchCourseInstance = async (courseInstanceId: string): Promise<CourseInstance> => {
  const res = await cmsClient.get(`/course-instances/${courseInstanceId}`, {
    headers: { "Content-Type": "application/json" },
  })
  return res.data
}
