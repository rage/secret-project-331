import {
  CourseInstanceEnrollmentsInfo,
  ResearchFormQuestionAnswer,
  UserResearchConsent,
} from "../../shared-module/common/bindings"
import {
  isCourseInstanceEnrollmentsInfo,
  isResearchFormQuestionAnswer,
  isUserResearchConsent,
} from "../../shared-module/common/bindings.guard"
import { isArray, validateResponse } from "../../shared-module/common/utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

export async function getCourseInstanceEnrollmentsInfo(
  userId: string,
): Promise<CourseInstanceEnrollmentsInfo> {
  const response = await mainFrontendClient.get(`/users/${userId}/course-instance-enrollments`)
  return validateResponse(response, isCourseInstanceEnrollmentsInfo)
}

export const postUserResearchConsent = async (consent: boolean): Promise<UserResearchConsent> => {
  const res = await mainFrontendClient.post(`/users/user-research-consents`, { consent })
  return validateResponse(res, isUserResearchConsent)
}

export const getResearchConsentByUserId = async (): Promise<UserResearchConsent> => {
  const res = await mainFrontendClient.get(`/users/get-user-research-consent`)
  return validateResponse(res, isUserResearchConsent)
}

export const getAllResearchConsentAnswersByUserId = async (): Promise<
  Array<ResearchFormQuestionAnswer>
> => {
  const res = await mainFrontendClient.get(`/users/user-research-form-question-answers`)
  return validateResponse(res, isArray(isResearchFormQuestionAnswer))
}
