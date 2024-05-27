import { isBoolean } from "lodash"

import { mainFrontendClient } from "../mainFrontendClient"

import {
  CertificateConfigurationAndRequirements,
  CourseInstance,
  CourseInstanceCompletionSummary,
  CourseInstanceForm,
  CourseModuleCompletion,
  EmailTemplate,
  EmailTemplateNew,
  ExerciseStatusSummaryForUser,
  ManualCompletionPreview,
  Points,
  SuspectedCheaters,
  TeacherManualCompletionRequest,
  ThresholdData,
  UserCourseInstanceProgress,
} from "@/shared-module/common/bindings"
import {
  isCertificateConfigurationAndRequirements,
  isCourseInstance,
  isCourseInstanceCompletionSummary,
  isCourseModuleCompletion,
  isEmailTemplate,
  isExerciseStatusSummaryForUser,
  isManualCompletionPreview,
  isPoints,
  isSuspectedCheaters,
  isThresholdData,
  isUserCourseInstanceProgress,
} from "@/shared-module/common/bindings.guard"
import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"

export const fetchCourseInstance = async (courseInstanceId: string): Promise<CourseInstance> => {
  const response = await mainFrontendClient.get(`/course-instances/${courseInstanceId}`)
  return validateResponse(response, isCourseInstance)
}

export const postNewEmailTemplateForCourseInstance = async (
  courseInstanceId: string,
  data: EmailTemplateNew,
): Promise<EmailTemplate> => {
  const response = await mainFrontendClient.post(
    `/course-instances/${courseInstanceId}/email-templates`,
    data,
  )
  return validateResponse(response, isEmailTemplate)
}

export const postReprocessModuleCompletions = async (
  courseInstanceId: string,
): Promise<boolean> => {
  const res = await mainFrontendClient.post(
    `/course-instances/${courseInstanceId}/reprocess-completions`,
  )
  return validateResponse(res, isBoolean)
}

export const fetchCourseInstanceEmailTemplates = async (
  courseInstanceId: string,
): Promise<EmailTemplate[]> => {
  const response = await mainFrontendClient.get(
    `/course-instances/${courseInstanceId}/email-templates`,
  )
  return validateResponse(response, isArray(isEmailTemplate))
}

export const getCompletions = async (
  courseInstanceId: string,
): Promise<CourseInstanceCompletionSummary> => {
  const response = await mainFrontendClient.get(`/course-instances/${courseInstanceId}/completions`)
  return validateResponse(response, isCourseInstanceCompletionSummary)
}

export const postNewThreshold = async (
  courseInstanceId: string,
  data: ThresholdData,
): Promise<ThresholdData> => {
  console.log("data", data)
  const res = await mainFrontendClient.post(`/course-instances/${courseInstanceId}/threshold`, data)
  return validateResponse(res, isThresholdData)
}

export const fetchSuspectedCheaters = async (
  courseInstanceId: string,
): Promise<SuspectedCheaters[]> => {
  console.log("In sc endpoint")
  const response = await mainFrontendClient.get(
    `/course-instances/${courseInstanceId}/suspected-cheaters`,
  )
  return validateResponse(response, isArray(isSuspectedCheaters))
}

export const postCompletionsPreview = async (
  courseInstanceId: string,
  data: TeacherManualCompletionRequest,
): Promise<ManualCompletionPreview> => {
  const response = await mainFrontendClient.post(
    `/course-instances/${courseInstanceId}/completions/preview`,
    data,
    { responseType: "json" },
  )
  return validateResponse(response, isManualCompletionPreview)
}

export const postCompletions = async (
  courseInstanceId: string,
  data: TeacherManualCompletionRequest,
): Promise<void> => {
  const _response = await mainFrontendClient.post(
    `/course-instances/${courseInstanceId}/completions`,
    data,
  )
}

export const getPoints = async (courseInstanceId: string): Promise<Points> => {
  const response = await mainFrontendClient.get(`/course-instances/${courseInstanceId}/points`)
  return validateResponse(response, isPoints)
}

export const getAllExerciseStatusSummariesForUserAndCourseInstance = async (
  courseInstanceId: string,
  userId: string,
): Promise<ExerciseStatusSummaryForUser[]> => {
  const response = await mainFrontendClient.get(
    `/course-instances/${courseInstanceId}/status-for-all-exercises/${userId}`,
  )
  return validateResponse(response, isArray(isExerciseStatusSummaryForUser))
}

export const getAllCourseModuleCompletionsForUserAndCourseInstance = async (
  courseInstanceId: string,
  userId: string,
): Promise<CourseModuleCompletion[]> => {
  const response = await mainFrontendClient.get(
    `/course-instances/${courseInstanceId}/course-module-completions/${userId}`,
  )
  return validateResponse(response, isArray(isCourseModuleCompletion))
}

export const getUserProgressForCourseInstance = async (
  courseInstanceId: string,
  userId: string,
): Promise<UserCourseInstanceProgress[]> => {
  const response = await mainFrontendClient.get(
    `/course-instances/${courseInstanceId}/progress/${userId}`,
  )
  return validateResponse(response, isArray(isUserCourseInstanceProgress))
}

export const editCourseInstance = async (
  courseInstanceId: string,
  update: CourseInstanceForm,
): Promise<void> => {
  await mainFrontendClient.post(`/course-instances/${courseInstanceId}/edit`, update)
}

export const deleteCourseInstance = async (courseInstanceId: string): Promise<void> => {
  await mainFrontendClient.post(`/course-instances/${courseInstanceId}/delete`)
}

export const fetchDefaultCertificateConfigurations = async (
  courseInstanceId: string,
): Promise<Array<CertificateConfigurationAndRequirements>> => {
  const res = await mainFrontendClient.get(
    `/course-instances/${courseInstanceId}/default-certificate-configurations`,
  )
  return validateResponse(res, isArray(isCertificateConfigurationAndRequirements))
}
