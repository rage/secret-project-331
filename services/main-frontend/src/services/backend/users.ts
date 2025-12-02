import { mainFrontendClient } from "../mainFrontendClient"

import {
  AuthorizedClientInfo,
  ConsentDenyQuery,
  ConsentQuery,
  ConsentResponse,
  Course,
  CourseInstanceEnrollmentsInfo,
  ExerciseResetLog,
  ResearchFormQuestionAnswer,
  UserResearchConsent,
} from "@/shared-module/common/bindings"
import {
  isAuthorizedClientInfo,
  isConsentResponse,
  isCourse,
  isCourseInstanceEnrollmentsInfo,
  isExerciseResetLog,
  isResearchFormQuestionAnswer,
  isUserResearchConsent,
} from "@/shared-module/common/bindings.guard"
import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"

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

export const getMyCourses = async (): Promise<Course[]> => {
  const response = await mainFrontendClient.get("/users/my-courses")
  return validateResponse(response, isArray(isCourse))
}

export const getUserResetExerciseLogs = async (
  userId: string,
): Promise<Array<ExerciseResetLog>> => {
  const response = await mainFrontendClient.get(`/users/${userId}/user-reset-exercise-logs`)
  return validateResponse(response, isArray(isExerciseResetLog))
}

export const getAuthorizedClientInfos = async (): Promise<AuthorizedClientInfo[]> => {
  const response = await mainFrontendClient.get(`/oauth/authorized-clients`)
  return validateResponse(response, isArray(isAuthorizedClientInfo))
}

export const revokeAuthorizedClient = async (clientId: string): Promise<void> => {
  await mainFrontendClient.delete(`/oauth/authorized-clients/${clientId}`)
}

export const postOAuthConsent = async (consentQuery: ConsentQuery): Promise<ConsentResponse> => {
  const response = await mainFrontendClient.post(`/oauth/consent`, consentQuery)
  return validateResponse(response, isConsentResponse)
}

export const postOAuthDeny = async (denyQuery: ConsentDenyQuery): Promise<ConsentResponse> => {
  const response = await mainFrontendClient.post(`/oauth/deny`, denyQuery)
  return validateResponse(response, isConsentResponse)
}
