import { useQuery, UseQueryResult } from "@tanstack/react-query"

import {
  getAvgTimeToFirstSubmissionHistory,
  getCohortActivityHistory,
  getCourseCompletionsHistory,
  getCourseCompletionsHistoryAllLanguageVersions,
  getCourseCompletionsHistoryByInstance,
  getFirstExerciseSubmissionsHistory,
  getFirstExerciseSubmissionsHistoryByInstance,
  getTotalUsersCompletedCourse,
  getTotalUsersCompletedCourseByInstance,
  getTotalUsersReturnedExercises,
  getTotalUsersReturnedExercisesByInstance,
  getTotalUsersStartedAllLanguageVersions,
  getTotalUsersStartedCourse,
  getTotalUsersStartedCourseByInstance,
  getUniqueUsersStartingHistory,
  getUniqueUsersStartingHistoryAllLanguageVersions,
  getUniqueUsersStartingHistoryByInstance,
  getUsersReturningExercisesHistory,
  getUsersReturningExercisesHistoryByInstance,
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

export const useAvgTimeToFirstSubmissionHistoryQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<AverageMetric[]> = {},
): UseQueryResult<AverageMetric[], Error> => {
  return useQuery<AverageMetric[], Error>({
    queryKey: ["course-stats", "avg-time-to-first-submission", courseId, granularity, timeWindow],
    queryFn: () =>
      getAvgTimeToFirstSubmissionHistory(
        assertNotNullOrUndefined(courseId),
        granularity,
        timeWindow,
      ),
    enabled: !!courseId,
    ...options,
  })
}

export const useTotalUsersStartedCourseByInstanceQuery = (
  courseId: string | null,
  options: HookQueryOptions<Record<string, CountResult>> = {},
): UseQueryResult<Record<string, CountResult>, Error> => {
  return useQuery<Record<string, CountResult>, Error>({
    queryKey: ["course-stats", "by-instance", "total-users-started", courseId],
    queryFn: () => getTotalUsersStartedCourseByInstance(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
    ...options,
  })
}

export const useTotalUsersCompletedCourseByInstanceQuery = (
  courseId: string | null,
  options: HookQueryOptions<Record<string, CountResult>> = {},
): UseQueryResult<Record<string, CountResult>, Error> => {
  return useQuery<Record<string, CountResult>, Error>({
    queryKey: ["course-stats", "by-instance", "total-users-completed", courseId],
    queryFn: () => getTotalUsersCompletedCourseByInstance(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
    ...options,
  })
}

export const useTotalUsersReturnedExercisesByInstanceQuery = (
  courseId: string | null,
  options: HookQueryOptions<Record<string, CountResult>> = {},
): UseQueryResult<Record<string, CountResult>, Error> => {
  return useQuery<Record<string, CountResult>, Error>({
    queryKey: ["course-stats", "by-instance", "total-users-returned-exercises", courseId],
    queryFn: () => getTotalUsersReturnedExercisesByInstance(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
    ...options,
  })
}

export const useCourseCompletionsHistoryByInstanceQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<Record<string, CountResult[]>> = {},
): UseQueryResult<Record<string, CountResult[]>, Error> => {
  return useQuery<Record<string, CountResult[]>, Error>({
    queryKey: [
      "course-stats",
      "by-instance",
      "completions-history",
      courseId,
      granularity,
      timeWindow,
    ],
    queryFn: () =>
      getCourseCompletionsHistoryByInstance(
        assertNotNullOrUndefined(courseId),
        granularity,
        timeWindow,
      ),
    enabled: !!courseId,
    ...options,
  })
}

export const useUniqueUsersStartingHistoryByInstanceQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<Record<string, CountResult[]>> = {},
): UseQueryResult<Record<string, CountResult[]>, Error> => {
  return useQuery<Record<string, CountResult[]>, Error>({
    queryKey: ["course-stats", "by-instance", "users-starting", courseId, granularity, timeWindow],
    queryFn: () =>
      getUniqueUsersStartingHistoryByInstance(
        assertNotNullOrUndefined(courseId),
        granularity,
        timeWindow,
      ),
    enabled: !!courseId,
    ...options,
  })
}

export const useFirstExerciseSubmissionsHistoryByInstanceQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<Record<string, CountResult[]>> = {},
): UseQueryResult<Record<string, CountResult[]>, Error> => {
  return useQuery<Record<string, CountResult[]>, Error>({
    queryKey: [
      "course-stats",
      "by-instance",
      "first-submissions",
      courseId,
      granularity,
      timeWindow,
    ],
    queryFn: () =>
      getFirstExerciseSubmissionsHistoryByInstance(
        assertNotNullOrUndefined(courseId),
        granularity,
        timeWindow,
      ),
    enabled: !!courseId,
    ...options,
  })
}

export const useUsersReturningExercisesHistoryByInstanceQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<Record<string, CountResult[]>> = {},
): UseQueryResult<Record<string, CountResult[]>, Error> => {
  return useQuery<Record<string, CountResult[]>, Error>({
    queryKey: [
      "course-stats",
      "by-instance",
      "users-returning-exercises",
      courseId,
      granularity,
      timeWindow,
    ],
    queryFn: () =>
      getUsersReturningExercisesHistoryByInstance(
        assertNotNullOrUndefined(courseId),
        granularity,
        timeWindow,
      ),
    enabled: !!courseId,
    ...options,
  })
}
