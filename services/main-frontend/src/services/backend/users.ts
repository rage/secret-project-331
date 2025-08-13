import { mainFrontendClient } from "../mainFrontendClient"

import {
  Course,
  CourseInstanceEnrollmentsInfo,
  ExerciseResetLog,
  ResearchFormQuestionAnswer,
  UserResearchConsent,
} from "@/shared-module/common/bindings"
import {
  isCourse,
  isCourseInstanceEnrollmentsInfo,
  isExerciseResetLog,
  isResearchFormQuestionAnswer,
  isUserResearchConsent,
} from "@/shared-module/common/bindings.guard"
import { isArray, isBoolean, validateResponse } from "@/shared-module/common/utils/fetching"

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

export const sendResetPasswordLink = async (email: string, language: string): Promise<boolean> => {
  const response = await mainFrontendClient.post(`/users/send-reset-password-email`, {
    email,
    language,
  })
  return validateResponse(response, isBoolean)
}

export const fetchResetPasswordTokenStatus = async (token: string): Promise<boolean> => {
  const response = await mainFrontendClient.get(`/users/reset-password-token-status/${token}`)
  return validateResponse(response, isBoolean)
}

export const postPasswordChange = async (token: string, new_password: string): Promise<boolean> => {
  const response = await mainFrontendClient.post(`/users/change-password`, {
    token,
    new_password,
  })

  return validateResponse(response, isBoolean)
}
