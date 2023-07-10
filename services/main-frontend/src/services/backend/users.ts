import { CourseInstanceEnrollmentsInfo, UserResearchConsent } from "../../shared-module/bindings"
import {
  isCourseInstanceEnrollmentsInfo,
  isUserResearchConsent,
} from "../../shared-module/bindings.guard"
import { validateResponse } from "../../shared-module/utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

export async function getCourseInstanceEnrollmentsInfo(
  userId: string,
): Promise<CourseInstanceEnrollmentsInfo> {
  const response = await mainFrontendClient.get(`/users/${userId}/course-instance-enrollments`)
  return validateResponse(response, isCourseInstanceEnrollmentsInfo)
}

export async function postUserReseachConsent(
  userId: string,
  consent: boolean,
): Promise<UserResearchConsent> {
  const res = await mainFrontendClient.post(`/users/${userId}/user-research-consents`, consent, {
    responseType: "json",
  })
  return validateResponse(res, isUserResearchConsent)
}
