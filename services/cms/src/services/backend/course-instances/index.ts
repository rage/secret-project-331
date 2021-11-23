import { CourseInstance } from "../../../shared-module/bindings"
import { isCourseInstance } from "../../../shared-module/bindings.guard"
import { validateResponse } from "../../../shared-module/utils/fetching"
import { cmsClient } from "../cmsClient"

export const fetchCourseInstance = async (courseInstanceId: string): Promise<CourseInstance> => {
  const response = await cmsClient.get(`/course-instances/${courseInstanceId}`, {
    headers: { "Content-Type": "application/json" },
  })
  return validateResponse(response, isCourseInstance)
}
