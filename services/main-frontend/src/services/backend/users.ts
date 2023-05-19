import { CourseInstanceEnrollmentsInfo } from "../../shared-module/bindings"
import { isCourseInstanceEnrollmentsInfo } from "../../shared-module/bindings.guard"
import { validateResponse } from "../../shared-module/utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

export async function getCourseInstanceEnrollmentsInfo(
  userId: string,
): Promise<CourseInstanceEnrollmentsInfo> {
  const response = await mainFrontendClient.get(`/users/${userId}/course-instance-enrollments`)
  return validateResponse(response, isCourseInstanceEnrollmentsInfo)
}
