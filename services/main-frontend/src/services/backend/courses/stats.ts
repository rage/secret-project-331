import { mainFrontendClient } from "../../mainFrontendClient"

import {
  AverageMetric,
  CohortActivity,
  CountResult,
  TimeGranularity,
} from "@/shared-module/common/bindings"
import {
  isAverageMetric,
  isCohortActivity,
  isCountResult,
} from "@/shared-module/common/bindings.guard"
import { isArray, isObjectMap, validateResponse } from "@/shared-module/common/utils/fetching"

export const getTotalUsersStartedCourse = async (courseId: string): Promise<CountResult> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/total-users-started-course`,
  )
  return validateResponse(response, isCountResult)
}

export const getTotalUsersCompletedCourse = async (courseId: string): Promise<CountResult> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/stats/total-users-completed`)
  return validateResponse(response, isCountResult)
}

export const getAvgTimeToFirstSubmissionHistory = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<AverageMetric[]> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/avg-time-to-first-submission/${granularity}/${timeWindow}`,
  )
  return validateResponse(response, isArray(isAverageMetric))
}

export const getTotalUsersReturnedExercises = async (courseId: string): Promise<CountResult> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/total-users-returned-exercises`,
  )
  return validateResponse(response, isCountResult)
}

export const getTotalUsersStartedAllLanguageVersions = async (
  courseId: string,
): Promise<CountResult> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/all-language-versions/total-users-started`,
  )
  return validateResponse(response, isCountResult)
}

export const getCourseCompletionsHistory = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<CountResult[]> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/completions-history/${granularity}/${timeWindow}`,
  )
  return validateResponse(response, isArray(isCountResult))
}

export const getCourseCompletionsHistoryAllLanguageVersions = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<CountResult[]> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/all-language-versions/completions-history/${granularity}/${timeWindow}`,
  )
  return validateResponse(response, isArray(isCountResult))
}

export const getUniqueUsersStartingHistory = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<CountResult[]> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/users-starting-history/${granularity}/${timeWindow}`,
  )
  return validateResponse(response, isArray(isCountResult))
}

export const getUniqueUsersStartingHistoryAllLanguageVersions = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<CountResult[]> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/all-language-versions/users-starting-history/${granularity}/${timeWindow}`,
  )
  return validateResponse(response, isArray(isCountResult))
}

export const getCohortActivityHistory = async (
  courseId: string,
  granularity: TimeGranularity,
  historyWindow: number,
  trackingWindow: number,
): Promise<CohortActivity[]> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/cohort-activity/${granularity}/${historyWindow}/${trackingWindow}`,
  )
  return validateResponse(response, isArray(isCohortActivity))
}

export const getUsersReturningExercisesHistory = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<CountResult[]> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/users-returning-exercises-history/${granularity}/${timeWindow}`,
  )
  return validateResponse(response, isArray(isCountResult))
}

export const getFirstExerciseSubmissionsHistory = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<CountResult[]> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/first-submissions-history/${granularity}/${timeWindow}`,
  )
  return validateResponse(response, isArray(isCountResult))
}

export const getTotalUsersStartedCourseByInstance = async (
  courseId: string,
): Promise<Record<string, CountResult>> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/by-instance/total-users-started-course`,
  )
  return validateResponse(response, isObjectMap(isCountResult))
}

export const getTotalUsersCompletedCourseByInstance = async (
  courseId: string,
): Promise<Record<string, CountResult>> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/by-instance/total-users-completed`,
  )
  return validateResponse(response, isObjectMap(isCountResult))
}

export const getTotalUsersReturnedExercisesByInstance = async (
  courseId: string,
): Promise<Record<string, CountResult>> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/by-instance/total-users-returned-exercises`,
  )
  return validateResponse(response, isObjectMap(isCountResult))
}

export const getCourseCompletionsHistoryByInstance = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<Record<string, CountResult[]>> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/by-instance/completions-history/${granularity}/${timeWindow}`,
  )
  return validateResponse(response, isObjectMap(isArray(isCountResult)))
}

export const getUniqueUsersStartingHistoryByInstance = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<Record<string, CountResult[]>> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/by-instance/users-starting-history/${granularity}/${timeWindow}`,
  )
  return validateResponse(response, isObjectMap(isArray(isCountResult)))
}

export const getFirstExerciseSubmissionsHistoryByInstance = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<Record<string, CountResult[]>> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/by-instance/first-submissions-history/${granularity}/${timeWindow}`,
  )
  return validateResponse(response, isObjectMap(isArray(isCountResult)))
}

export const getUsersReturningExercisesHistoryByInstance = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<Record<string, CountResult[]>> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/by-instance/users-returning-exercises-history/${granularity}/${timeWindow}`,
  )
  return validateResponse(response, isObjectMap(isArray(isCountResult)))
}
