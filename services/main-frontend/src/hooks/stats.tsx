import { useQuery, UseQueryResult } from "@tanstack/react-query"

import {
  getAvgTimeToFirstSubmissionByMonth,
  getCohortActivityHistory,
  getCourseCompletionsHistory,
  getCourseCompletionsHistoryAllLanguageVersions,
  getDailyUniqueUsersStarting,
  getFirstExerciseSubmissionsHistory,
  getTotalUsersCompletedCourse,
  getTotalUsersReturnedExercises,
  getTotalUsersStartedAllLanguageVersions,
  getTotalUsersStartedCourse,
  getUniqueUsersStartingHistory,
  getUniqueUsersStartingHistoryAllLanguageVersions,
  getUsersReturningExercisesHistory,
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

export const useUsersReturningExercisesHistoryQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>({
    queryKey: ["course-stats", "users-returning-exercises", courseId, granularity, timeWindow],
    queryFn: () =>
      getUsersReturningExercisesHistory(
        assertNotNullOrUndefined(courseId),
        granularity,
        timeWindow,
      ),
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

export const useUniqueUsersStartingHistoryQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>({
    queryKey: ["course-stats", "users-starting", courseId, granularity, timeWindow],
    queryFn: () =>
      getUniqueUsersStartingHistory(assertNotNullOrUndefined(courseId), granularity, timeWindow),
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

export const useFirstExerciseSubmissionsHistoryQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>({
    queryKey: ["course-stats", "first-submissions", courseId, granularity, timeWindow],
    queryFn: () =>
      getFirstExerciseSubmissionsHistory(
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
