import { useQuery, UseQueryResult } from "@tanstack/react-query"

import {
  getAvgTimeToFirstSubmissionByMonth,
  getCohortActivityHistory,
  getCourseCompletionsHistory,
  getCourseCompletionsHistoryAllLanguageVersions,
  getDailyFirstExerciseSubmissions,
  getDailyUniqueUsersStarting,
  getDailyUsersReturningExercises,
  getMonthlyFirstExerciseSubmissions,
  getMonthlyUniqueUsersStarting,
  getMonthlyUsersReturningExercises,
  getTotalUsersCompletedCourse,
  getTotalUsersReturnedExercises,
  getTotalUsersStartedAllLanguageVersions,
  getTotalUsersStartedCourse,
  getUniqueUsersStartingHistoryAllLanguageVersions,
  getWeeklyUniqueUsersStarting,
} from "../services/backend/courses/stats"

import { HookQueryOptions } from "."

import {
  AverageMetric,
  CohortActivity,
  CountResult,
  TimeGranularity,
} from "@/shared-module/common/bindings"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

export const useTotalUsersStartedCourseQuery = (
  courseId: string | null,
  options: HookQueryOptions<CountResult> = {},
): UseQueryResult<CountResult, Error> => {
  return useQuery<CountResult, Error>({
    queryKey: ["course-stats", "total-users-started", courseId],
    queryFn: () => getTotalUsersStartedCourse(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
    ...options,
  })
}

export const useTotalUsersCompletedCourseQuery = (
  courseId: string | null,
  options: HookQueryOptions<CountResult> = {},
): UseQueryResult<CountResult, Error> => {
  return useQuery<CountResult, Error>({
    queryKey: ["course-stats", "total-users-completed", courseId],
    queryFn: () => getTotalUsersCompletedCourse(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
    ...options,
  })
}

export const useWeeklyUniqueUsersStartingQuery = (
  courseId: string | null,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>({
    queryKey: ["course-stats", "weekly-users-starting", courseId],
    queryFn: () => getWeeklyUniqueUsersStarting(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
    ...options,
  })
}

export const useDailyUniqueUsersStartingQuery = (
  courseId: string | null,
  days: number,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>({
    queryKey: ["course-stats", "daily-users-starting", courseId, days],
    queryFn: () => getDailyUniqueUsersStarting(assertNotNullOrUndefined(courseId), days),
    enabled: !!courseId,
    ...options,
  })
}

export const useMonthlyUniqueUsersStartingQuery = (
  courseId: string | null,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>({
    queryKey: ["course-stats", "monthly-users-starting", courseId],
    queryFn: () => getMonthlyUniqueUsersStarting(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
    ...options,
  })
}

export const useMonthlyFirstExerciseSubmissionsQuery = (
  courseId: string | null,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>({
    queryKey: ["course-stats", "monthly-first-submissions", courseId],
    queryFn: () => getMonthlyFirstExerciseSubmissions(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
    ...options,
  })
}

export const useDailyFirstExerciseSubmissionsQuery = (
  courseId: string | null,
  days: number,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>({
    queryKey: ["course-stats", "daily-first-submissions", courseId, days],
    queryFn: () => getDailyFirstExerciseSubmissions(assertNotNullOrUndefined(courseId), days),
    enabled: !!courseId,
    ...options,
  })
}

export const useMonthlyUsersReturningExercisesQuery = (
  courseId: string | null,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>({
    queryKey: ["course-stats", "monthly-returning-exercises", courseId],
    queryFn: () => getMonthlyUsersReturningExercises(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
    ...options,
  })
}

export const useDailyUsersReturningExercisesQuery = (
  courseId: string | null,
  days: number,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>({
    queryKey: ["course-stats", "daily-returning-exercises", courseId, days],
    queryFn: () => getDailyUsersReturningExercises(assertNotNullOrUndefined(courseId), days),
    enabled: !!courseId,
    ...options,
  })
}

export const useAvgTimeToFirstSubmissionByMonthQuery = (
  courseId: string | null,
  options: HookQueryOptions<AverageMetric[]> = {},
): UseQueryResult<AverageMetric[], Error> => {
  return useQuery<AverageMetric[], Error>({
    queryKey: ["course-stats", "avg-time-to-first-submission", courseId],
    queryFn: () => getAvgTimeToFirstSubmissionByMonth(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
    ...options,
  })
}

export const useTotalUsersReturnedExercisesQuery = (
  courseId: string | null,
  options: HookQueryOptions<CountResult> = {},
): UseQueryResult<CountResult, Error> => {
  return useQuery<CountResult, Error>({
    queryKey: ["course-stats", "total-users-returned-exercises", courseId],
    queryFn: () => getTotalUsersReturnedExercises(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
    ...options,
  })
}

export const useTotalUsersStartedAllLanguageVersionsQuery = (
  courseId: string | null,
  options: HookQueryOptions<CountResult> = {},
): UseQueryResult<CountResult, Error> => {
  return useQuery<CountResult, Error>({
    queryKey: ["course-stats", "all-language-versions", "total-users-started", courseId],
    queryFn: () => getTotalUsersStartedAllLanguageVersions(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
    ...options,
  })
}

export const useCourseCompletionsHistoryQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>({
    queryKey: ["course-stats", "completions-history", courseId, granularity, timeWindow],
    queryFn: () =>
      getCourseCompletionsHistory(assertNotNullOrUndefined(courseId), granularity, timeWindow),
    enabled: !!courseId,
    ...options,
  })
}

export const useCourseCompletionsHistoryAllLanguageVersionsQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>({
    queryKey: [
      "course-stats",
      "all-language-versions",
      "completions-history",
      courseId,
      granularity,
      timeWindow,
    ],
    queryFn: () =>
      getCourseCompletionsHistoryAllLanguageVersions(
        assertNotNullOrUndefined(courseId),
        granularity,
        timeWindow,
      ),
    enabled: !!courseId,
    ...options,
  })
}

export const useUniqueUsersStartingHistoryAllLanguageVersionsQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>({
    queryKey: [
      "course-stats",
      "all-language-versions",
      "users-starting-history",
      courseId,
      granularity,
      timeWindow,
    ],
    queryFn: () =>
      getUniqueUsersStartingHistoryAllLanguageVersions(
        assertNotNullOrUndefined(courseId),
        granularity,
        timeWindow,
      ),
    enabled: !!courseId,
    ...options,
  })
}

export const useCohortActivityHistoryQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  historyWindow: number,
  trackingWindow: number,
  options: HookQueryOptions<CohortActivity[]> = {},
): UseQueryResult<CohortActivity[], Error> => {
  return useQuery<CohortActivity[], Error>({
    queryKey: [
      "course-stats",
      "cohort-activity",
      courseId,
      granularity,
      historyWindow,
      trackingWindow,
    ],
    queryFn: () =>
      getCohortActivityHistory(
        assertNotNullOrUndefined(courseId),
        granularity,
        historyWindow,
        trackingWindow,
      ),
    enabled: !!courseId,
    ...options,
  })
}
