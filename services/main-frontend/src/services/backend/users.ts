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

export const postUserResearchConsent = async (
  userId: string,
  consent: boolean,
): Promise<UserResearchConsent> => {
  const res = await mainFrontendClient.post(
    `/users/${userId}/user-research-consents`,
    { consent },
    {
      responseType: "json",
    },
  )
  return validateResponse(res, isUserResearchConsent)
}

export const getResearchConsentByUserId = async (userId: string): Promise<UserResearchConsent> => {
  const res = await mainFrontendClient.get(`/users/${userId}/get-user-research-consent`)
  return validateResponse(res, isUserResearchConsent)
}
