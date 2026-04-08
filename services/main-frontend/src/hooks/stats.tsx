"use client"

import { useQuery, UseQueryOptions, UseQueryResult } from "@tanstack/react-query"

import {
  getAvgTimeToFirstSubmissionHistoryOptions,
  getCohortActivityHistoryOptions,
  getCourseCompletionsHistoryAllLanguageVersionsOptions,
  getCourseCompletionsHistoryByInstanceOptions,
  getCourseCompletionsHistoryForCustomTimePeriodOptions,
  getCourseCompletionsHistoryOptions,
  getFirstExerciseSubmissionsByModuleOptions,
  getFirstExerciseSubmissionsHistoryByInstanceOptions,
  getFirstExerciseSubmissionsHistoryOptions,
  getStudentCompletionsByCountryOptions,
  getStudentEnrollmentsByCountryOptions,
  getStudentsByCountryTotalsOptions,
  getTotalUsersCompletedCourseByInstanceOptions,
  getTotalUsersCompletedCourseCustomTimePeriodOptions,
  getTotalUsersCompletedCourseOptions,
  getTotalUsersReturnedExercisesByInstanceOptions,
  getTotalUsersReturnedExercisesCustomTimePeriodOptions,
  getTotalUsersReturnedExercisesOptions,
  getTotalUsersStartedAllLanguageVersionsOptions,
  getTotalUsersStartedCourseByInstanceOptions,
  getTotalUsersStartedCourseCustomTimePeriodOptions,
  getTotalUsersStartedCourseOptions,
  getUniqueUsersStartingHistoryAllLanguageVersionsOptions,
  getUniqueUsersStartingHistoryByInstanceOptions,
  getUniqueUsersStartingHistoryCustomTimePeriodOptions,
  getUniqueUsersStartingHistoryOptions,
  getUsersReturningExercisesHistoryByInstanceOptions,
  getUsersReturningExercisesHistoryOptions,
} from "../services/backend/courses/stats"

import { HookQueryOptions } from "."

import {
  AverageMetric,
  CohortActivity,
  CountResult,
  StudentsByCountryTotalsResult,
  TimeGranularity,
} from "@/shared-module/common/bindings"

function withGeneratedQueryOptions<TData>(
  generatedOptions: unknown,
  enabled: boolean,
  options: HookQueryOptions<TData> = {},
): UseQueryOptions<TData, Error, TData> {
  return {
    ...(generatedOptions as UseQueryOptions<TData, Error, TData>),
    enabled,
    ...options,
  }
}

export const useTotalUsersStartedCourseQuery = (
  courseId: string | null,
  options: HookQueryOptions<CountResult> = {},
): UseQueryResult<CountResult, Error> => {
  return useQuery<CountResult, Error>(
    withGeneratedQueryOptions(
      getTotalUsersStartedCourseOptions(courseId ?? ""),
      !!courseId,
      options,
    ),
  )
}

export const useTotalUsersCompletedCourseQuery = (
  courseId: string | null,
  options: HookQueryOptions<CountResult> = {},
): UseQueryResult<CountResult, Error> => {
  return useQuery<CountResult, Error>(
    withGeneratedQueryOptions(
      getTotalUsersCompletedCourseOptions(courseId ?? ""),
      !!courseId,
      options,
    ),
  )
}

export const useUsersReturningExercisesHistoryQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>(
    withGeneratedQueryOptions(
      getUsersReturningExercisesHistoryOptions(courseId ?? "", granularity, timeWindow),
      !!courseId,
      options,
    ),
  )
}

export const useTotalUsersReturnedExercisesQuery = (
  courseId: string | null,
  options: HookQueryOptions<CountResult> = {},
): UseQueryResult<CountResult, Error> => {
  return useQuery<CountResult, Error>(
    withGeneratedQueryOptions(
      getTotalUsersReturnedExercisesOptions(courseId ?? ""),
      !!courseId,
      options,
    ),
  )
}

export const useTotalUsersStartedAllLanguageVersionsQuery = (
  courseId: string | null,
  options: HookQueryOptions<CountResult> = {},
): UseQueryResult<CountResult, Error> => {
  return useQuery<CountResult, Error>(
    withGeneratedQueryOptions(
      getTotalUsersStartedAllLanguageVersionsOptions(courseId ?? ""),
      !!courseId,
      options,
    ),
  )
}

export const useCourseCompletionsHistoryQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>(
    withGeneratedQueryOptions(
      getCourseCompletionsHistoryOptions(courseId ?? "", granularity, timeWindow),
      !!courseId,
      options,
    ),
  )
}

export const useCourseCompletionsHistoryAllLanguageVersionsQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>(
    withGeneratedQueryOptions(
      getCourseCompletionsHistoryAllLanguageVersionsOptions(
        courseId ?? "",
        granularity,
        timeWindow,
      ),
      !!courseId,
      options,
    ),
  )
}

export const useUniqueUsersStartingHistoryQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>(
    withGeneratedQueryOptions(
      getUniqueUsersStartingHistoryOptions(courseId ?? "", granularity, timeWindow),
      !!courseId,
      options,
    ),
  )
}

export const useCohortActivityHistoryQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  historyWindow: number,
  trackingWindow: number,
  options: HookQueryOptions<CohortActivity[]> = {},
): UseQueryResult<CohortActivity[], Error> => {
  return useQuery<CohortActivity[], Error>(
    withGeneratedQueryOptions(
      getCohortActivityHistoryOptions(courseId ?? "", granularity, historyWindow, trackingWindow),
      !!courseId,
      options,
    ),
  )
}

export const useFirstExerciseSubmissionsHistoryQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>(
    withGeneratedQueryOptions(
      getFirstExerciseSubmissionsHistoryOptions(courseId ?? "", granularity, timeWindow),
      !!courseId,
      options,
    ),
  )
}

export const useUniqueUsersStartingHistoryAllLanguageVersionsQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>(
    withGeneratedQueryOptions(
      getUniqueUsersStartingHistoryAllLanguageVersionsOptions(
        courseId ?? "",
        granularity,
        timeWindow,
      ),
      !!courseId,
      options,
    ),
  )
}

export const useAvgTimeToFirstSubmissionHistoryQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<AverageMetric[]> = {},
): UseQueryResult<AverageMetric[], Error> => {
  return useQuery<AverageMetric[], Error>(
    withGeneratedQueryOptions(
      getAvgTimeToFirstSubmissionHistoryOptions(courseId ?? "", granularity, timeWindow),
      !!courseId,
      options,
    ),
  )
}

export const useTotalUsersStartedCourseByInstanceQuery = (
  courseId: string | null,
  options: HookQueryOptions<Record<string, CountResult>> = {},
): UseQueryResult<Record<string, CountResult>, Error> => {
  return useQuery<Record<string, CountResult>, Error>(
    withGeneratedQueryOptions(
      getTotalUsersStartedCourseByInstanceOptions(courseId ?? ""),
      !!courseId,
      options,
    ),
  )
}

export const useTotalUsersCompletedCourseByInstanceQuery = (
  courseId: string | null,
  options: HookQueryOptions<Record<string, CountResult>> = {},
): UseQueryResult<Record<string, CountResult>, Error> => {
  return useQuery<Record<string, CountResult>, Error>(
    withGeneratedQueryOptions(
      getTotalUsersCompletedCourseByInstanceOptions(courseId ?? ""),
      !!courseId,
      options,
    ),
  )
}

export const useTotalUsersReturnedExercisesByInstanceQuery = (
  courseId: string | null,
  options: HookQueryOptions<Record<string, CountResult>> = {},
): UseQueryResult<Record<string, CountResult>, Error> => {
  return useQuery<Record<string, CountResult>, Error>(
    withGeneratedQueryOptions(
      getTotalUsersReturnedExercisesByInstanceOptions(courseId ?? ""),
      !!courseId,
      options,
    ),
  )
}

export const useCourseCompletionsHistoryByInstanceQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<Record<string, CountResult[]>> = {},
): UseQueryResult<Record<string, CountResult[]>, Error> => {
  return useQuery<Record<string, CountResult[]>, Error>(
    withGeneratedQueryOptions(
      getCourseCompletionsHistoryByInstanceOptions(courseId ?? "", granularity, timeWindow),
      !!courseId,
      options,
    ),
  )
}

export const useUniqueUsersStartingHistoryByInstanceQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<Record<string, CountResult[]>> = {},
): UseQueryResult<Record<string, CountResult[]>, Error> => {
  return useQuery<Record<string, CountResult[]>, Error>(
    withGeneratedQueryOptions(
      getUniqueUsersStartingHistoryByInstanceOptions(courseId ?? "", granularity, timeWindow),
      !!courseId,
      options,
    ),
  )
}

export const useFirstExerciseSubmissionsHistoryByInstanceQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<Record<string, CountResult[]>> = {},
): UseQueryResult<Record<string, CountResult[]>, Error> => {
  return useQuery<Record<string, CountResult[]>, Error>(
    withGeneratedQueryOptions(
      getFirstExerciseSubmissionsHistoryByInstanceOptions(courseId ?? "", granularity, timeWindow),
      !!courseId,
      options,
    ),
  )
}

export const useUsersReturningExercisesHistoryByInstanceQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<Record<string, CountResult[]>> = {},
): UseQueryResult<Record<string, CountResult[]>, Error> => {
  return useQuery<Record<string, CountResult[]>, Error>(
    withGeneratedQueryOptions(
      getUsersReturningExercisesHistoryByInstanceOptions(courseId ?? "", granularity, timeWindow),
      !!courseId,
      options,
    ),
  )
}

export const useStudentsByCountryQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  country: string | null,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>(
    withGeneratedQueryOptions(
      getStudentEnrollmentsByCountryOptions(courseId ?? "", granularity, timeWindow, country ?? ""),
      !!courseId && !!country,
      options,
    ),
  )
}

export const useStudentCompletionsByCountryQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  country: string | null,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>(
    withGeneratedQueryOptions(
      getStudentCompletionsByCountryOptions(courseId ?? "", granularity, timeWindow, country ?? ""),
      !!courseId && !!country,
      options,
    ),
  )
}

export const useCourseCompletionsHistoryCustomTimePeriodQuery = (
  courseId: string | null,
  startDate: string,
  endDate: string,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>(
    withGeneratedQueryOptions(
      getCourseCompletionsHistoryForCustomTimePeriodOptions(courseId ?? "", startDate, endDate),
      !!courseId && !!startDate && !!endDate,
      options,
    ),
  )
}

export const useStudentsByCountryTotalsQuery = (
  courseId: string | null,
): UseQueryResult<StudentsByCountryTotalsResult[], Error> => {
  return useQuery<StudentsByCountryTotalsResult[], Error>(
    withGeneratedQueryOptions(getStudentsByCountryTotalsOptions(courseId ?? ""), !!courseId),
  )
}

export const useFirstExerciseSubmissionsByModuleQuery = (
  courseId: string | null,
  granularity: TimeGranularity,
  timeWindow: number,
  options: HookQueryOptions<Record<string, CountResult[]>> = {},
): UseQueryResult<Record<string, CountResult[]>, Error> => {
  return useQuery<Record<string, CountResult[]>, Error>(
    withGeneratedQueryOptions(
      getFirstExerciseSubmissionsByModuleOptions(courseId ?? "", granularity, timeWindow),
      !!courseId,
      options,
    ),
  )
}

export const useUniqueUsersStartingHistoryQueryCustomTimePeriod = (
  courseId: string | null,
  startDate: string,
  endDate: string,
  options: HookQueryOptions<CountResult[]> = {},
): UseQueryResult<CountResult[], Error> => {
  return useQuery<CountResult[], Error>(
    withGeneratedQueryOptions(
      getUniqueUsersStartingHistoryCustomTimePeriodOptions(courseId ?? "", startDate, endDate),
      !!courseId && !!startDate && !!endDate,
      options,
    ),
  )
}

export const useTotalUsersStartedCourseQueryCustomTimePeriod = (
  courseId: string | null,
  startDate: string,
  endDate: string,
  options: HookQueryOptions<CountResult> = {},
): UseQueryResult<CountResult, Error> => {
  return useQuery<CountResult, Error>(
    withGeneratedQueryOptions(
      getTotalUsersStartedCourseCustomTimePeriodOptions(courseId ?? "", startDate, endDate),
      !!courseId && !!startDate && !!endDate,
      options,
    ),
  )
}

export const useTotalUsersCompletedCourseQueryCustomTimePeriod = (
  courseId: string | null,
  startDate: string,
  endDate: string,
  options: HookQueryOptions<CountResult> = {},
): UseQueryResult<CountResult, Error> => {
  return useQuery<CountResult, Error>(
    withGeneratedQueryOptions(
      getTotalUsersCompletedCourseCustomTimePeriodOptions(courseId ?? "", startDate, endDate),
      !!courseId && !!startDate && !!endDate,
      options,
    ),
  )
}

export const useTotalUsersReturnedExercisesQueryCustomTimePeriod = (
  courseId: string | null,
  startDate: string,
  endDate: string,
  options: HookQueryOptions<CountResult> = {},
): UseQueryResult<CountResult, Error> => {
  return useQuery<CountResult, Error>(
    withGeneratedQueryOptions(
      getTotalUsersReturnedExercisesCustomTimePeriodOptions(courseId ?? "", startDate, endDate),
      !!courseId && !!startDate && !!endDate,
      options,
    ),
  )
}
