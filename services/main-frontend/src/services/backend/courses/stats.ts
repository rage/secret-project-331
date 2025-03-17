import { mainFrontendClient } from "../../mainFrontendClient"

import { AverageMetric, CohortActivity, CountResult } from "@/shared-module/common/bindings"
import {
  isAverageMetric,
  isCohortActivity,
  isCountResult,
} from "@/shared-module/common/bindings.guard"
import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"

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

export const getWeeklyUniqueUsersStarting = async (courseId: string): Promise<CountResult[]> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/stats/weekly-users-starting`)
  return validateResponse(response, isArray(isCountResult))
}

export const getDailyUniqueUsersStarting = async (
  courseId: string,
  days: number,
): Promise<CountResult[]> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/daily-users-starting/${days}`,
  )
  return validateResponse(response, isArray(isCountResult))
}

export const getMonthlyUniqueUsersStarting = async (courseId: string): Promise<CountResult[]> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/stats/monthly-users-starting`)
  return validateResponse(response, isArray(isCountResult))
}

export const getMonthlyFirstExerciseSubmissions = async (
  courseId: string,
): Promise<CountResult[]> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/monthly-first-submissions`,
  )
  return validateResponse(response, isArray(isCountResult))
}

export const getDailyFirstExerciseSubmissions = async (
  courseId: string,
  days: number,
): Promise<CountResult[]> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/daily-first-submissions/${days}`,
  )
  return validateResponse(response, isArray(isCountResult))
}

export const getMonthlyUsersReturningExercises = async (
  courseId: string,
): Promise<CountResult[]> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/monthly-returning-exercises`,
  )
  return validateResponse(response, isArray(isCountResult))
}

export const getDailyUsersReturningExercises = async (
  courseId: string,
  days: number,
): Promise<CountResult[]> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/daily-returning-exercises/${days}`,
  )
  return validateResponse(response, isArray(isCountResult))
}

export const getMonthlyCourseCompletions = async (courseId: string): Promise<CountResult[]> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/stats/monthly-completions`)
  return validateResponse(response, isArray(isCountResult))
}

export const getDailyCourseCompletions = async (
  courseId: string,
  days: number,
): Promise<CountResult[]> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/daily-completions/${days}`,
  )
  return validateResponse(response, isArray(isCountResult))
}

export const getAvgTimeToFirstSubmissionByMonth = async (
  courseId: string,
): Promise<AverageMetric[]> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/avg-time-to-first-submission`,
  )
  return validateResponse(response, isArray(isAverageMetric))
}

export const getCohortWeeklyActivity = async (
  courseId: string,
  months: number,
): Promise<CohortActivity[]> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/cohort-weekly-activity/${months}`,
  )
  return validateResponse(response, isArray(isCohortActivity))
}

export const getCohortDailyActivity = async (
  courseId: string,
  days: number,
): Promise<CohortActivity[]> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/cohort-daily-activity/${days}`,
  )
  return validateResponse(response, isArray(isCohortActivity))
}

export const getTotalUsersReturnedExercises = async (courseId: string): Promise<CountResult> => {
  const response = await mainFrontendClient.get(
    `/courses/${courseId}/stats/total-users-returned-exercises`,
  )
  return validateResponse(response, isCountResult)
}
