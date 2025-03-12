import { mainFrontendClient } from "../../mainFrontendClient"

import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"

interface CountResult {
  count: number
  date?: string
}

interface AverageMetric {
  average: number
  date: string
}

interface CohortActivity {
  cohort_start_date: string
  activity_date: string
  active_users: number
  total_users: number
}

const isCountResult = (data: unknown): data is CountResult => {
  const obj = data as CountResult
  return typeof obj.count === "number" && (obj.date === undefined || typeof obj.date === "string")
}

const isAverageMetric = (data: unknown): data is AverageMetric => {
  const obj = data as AverageMetric
  return typeof obj.average === "number" && typeof obj.date === "string"
}

const isCohortActivity = (data: unknown): data is CohortActivity => {
  const obj = data as CohortActivity
  return (
    typeof obj.cohort_start_date === "string" &&
    typeof obj.activity_date === "string" &&
    typeof obj.active_users === "number" &&
    typeof obj.total_users === "number"
  )
}

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
