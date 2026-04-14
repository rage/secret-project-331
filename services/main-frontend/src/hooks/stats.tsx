"use client"

import { queryOptions, useQuery, UseQueryOptions, UseQueryResult } from "@tanstack/react-query"

import { HookQueryOptions } from "."

import {
  getAvgTimeToFirstSubmissionHistoryOptions as getAvgTimeToFirstSubmissionHistoryGeneratedOptions,
  getCohortActivityHistoryOptions as getCohortActivityHistoryGeneratedOptions,
  getCourseCompletionsHistoryAllLanguageVersionsOptions as getCourseCompletionsHistoryAllLanguageVersionsGeneratedOptions,
  getCourseCompletionsHistoryByInstanceOptions as getCourseCompletionsHistoryByInstanceGeneratedOptions,
  getCourseCompletionsHistoryCustomTimePeriodOptions as getCourseCompletionsHistoryCustomTimePeriodGeneratedOptions,
  getCourseCompletionsHistoryOptions as getCourseCompletionsHistoryGeneratedOptions,
  getFirstExerciseSubmissionsByModuleOptions as getFirstExerciseSubmissionsByModuleGeneratedOptions,
  getFirstExerciseSubmissionsHistoryByInstanceOptions as getFirstExerciseSubmissionsHistoryByInstanceGeneratedOptions,
  getFirstExerciseSubmissionsHistoryOptions as getFirstExerciseSubmissionsHistoryGeneratedOptions,
  getStudentCompletionsByCountryOptions as getStudentCompletionsByCountryGeneratedOptions,
  getStudentEnrollmentsByCountryOptions as getStudentEnrollmentsByCountryGeneratedOptions,
  getStudentsByCountryTotalsOptions as getStudentsByCountryTotalsGeneratedOptions,
  getTotalUsersCompletedCourseByInstanceOptions as getTotalUsersCompletedCourseByInstanceGeneratedOptions,
  getTotalUsersCompletedCourseCustomTimePeriodOptions as getTotalUsersCompletedCourseCustomTimePeriodGeneratedOptions,
  getTotalUsersCompletedCourseOptions as getTotalUsersCompletedCourseGeneratedOptions,
  getTotalUsersReturnedExercisesByInstanceOptions as getTotalUsersReturnedExercisesByInstanceGeneratedOptions,
  getTotalUsersReturnedExercisesCustomTimePeriodOptions as getTotalUsersReturnedExercisesCustomTimePeriodGeneratedOptions,
  getTotalUsersReturnedExercisesOptions as getTotalUsersReturnedExercisesGeneratedOptions,
  getTotalUsersStartedAllLanguageVersionsOptions as getTotalUsersStartedAllLanguageVersionsGeneratedOptions,
  getTotalUsersStartedCourseByInstanceOptions as getTotalUsersStartedCourseByInstanceGeneratedOptions,
  getTotalUsersStartedCourseCustomTimePeriodOptions as getTotalUsersStartedCourseCustomTimePeriodGeneratedOptions,
  getTotalUsersStartedCourseOptions as getTotalUsersStartedCourseGeneratedOptions,
  getUniqueUsersStartingHistoryAllLanguageVersionsOptions as getUniqueUsersStartingHistoryAllLanguageVersionsGeneratedOptions,
  getUniqueUsersStartingHistoryByInstanceOptions as getUniqueUsersStartingHistoryByInstanceGeneratedOptions,
  getUniqueUsersStartingHistoryCustomTimePeriodOptions as getUniqueUsersStartingHistoryCustomTimePeriodGeneratedOptions,
  getUniqueUsersStartingHistoryOptions as getUniqueUsersStartingHistoryGeneratedOptions,
  getUsersReturningExercisesHistoryByInstanceOptions as getUsersReturningExercisesHistoryByInstanceGeneratedOptions,
  getUsersReturningExercisesHistoryOptions as getUsersReturningExercisesHistoryGeneratedOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  AverageMetric,
  CohortActivity,
  CountResult,
  StudentsByCountryTotalsResult,
  TimeGranularity,
} from "@/generated/api/types.generated"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const disabledQueryKey = (id: string, extras?: Record<string, unknown>) =>
  [{ _id: id, ...(extras ?? {}) }] as const

type BuiltQueryOptions<TData> = UseQueryOptions<TData, Error, TData>

const withCourseId = (courseId: string) => ({
  path: {
    course_id: courseId,
  },
})

const withGranularityAndWindow = (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
) => ({
  path: {
    course_id: courseId,
    granularity,
    time_window: timeWindow,
  },
})

const withHistoryAndTrackingWindow = (
  courseId: string,
  granularity: TimeGranularity,
  historyWindow: number,
  trackingWindow: number,
) => ({
  path: {
    course_id: courseId,
    granularity,
    history_window: historyWindow,
    tracking_window: trackingWindow,
  },
})

const withCountry = (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
  country: string,
) => ({
  path: {
    course_id: courseId,
    granularity,
    time_window: timeWindow,
    country,
  },
})

const withCustomTimePeriod = (courseId: string, startDate: string, endDate: string) => ({
  path: {
    course_id: courseId,
    start_date: startDate,
    end_date: endDate,
  },
})

type GeneratedOptionsWithKey = {
  queryKey: readonly unknown[]
}

const buildDisabledQueryOptions = <TData,>(
  queryKey: readonly unknown[],
  requiredValues: readonly unknown[],
): BuiltQueryOptions<TData> =>
  queryOptions<TData, Error>({
    queryKey,
    queryFn: async () => {
      requiredValues.forEach((value) => assertNotNullOrUndefined(value))
      throw new Error("Disabled query executed unexpectedly")
    },
  })

function buildCourseOnlyQueryOptions<TData>(
  courseId: string | null | undefined,
  getGeneratedOptions: (args: ReturnType<typeof withCourseId>) => GeneratedOptionsWithKey,
): BuiltQueryOptions<TData> {
  if (courseId != null) {
    return getGeneratedOptions(withCourseId(courseId)) as BuiltQueryOptions<TData>
  }

  return buildDisabledQueryOptions<TData>(
    disabledQueryKey(getGeneratedOptions.name, {
      path: {
        course_id: courseId,
      },
    }),
    [courseId],
  )
}

function buildGranularityAndWindowQueryOptions<TData>(
  courseId: string | null | undefined,
  granularity: TimeGranularity,
  timeWindow: number,
  getGeneratedOptions: (
    args: ReturnType<typeof withGranularityAndWindow>,
  ) => GeneratedOptionsWithKey,
): BuiltQueryOptions<TData> {
  if (courseId != null) {
    return getGeneratedOptions(
      withGranularityAndWindow(courseId, granularity, timeWindow),
    ) as BuiltQueryOptions<TData>
  }

  return buildDisabledQueryOptions<TData>(
    disabledQueryKey(getGeneratedOptions.name, {
      path: {
        course_id: courseId,
        granularity,
        time_window: timeWindow,
      },
    }),
    [courseId],
  )
}

function buildHistoryAndTrackingWindowQueryOptions<TData>(
  courseId: string | null | undefined,
  granularity: TimeGranularity,
  historyWindow: number,
  trackingWindow: number,
  getGeneratedOptions: (
    args: ReturnType<typeof withHistoryAndTrackingWindow>,
  ) => GeneratedOptionsWithKey,
): BuiltQueryOptions<TData> {
  if (courseId != null) {
    return getGeneratedOptions(
      withHistoryAndTrackingWindow(courseId, granularity, historyWindow, trackingWindow),
    ) as BuiltQueryOptions<TData>
  }

  return buildDisabledQueryOptions<TData>(
    disabledQueryKey(getGeneratedOptions.name, {
      path: {
        course_id: courseId,
        granularity,
        history_window: historyWindow,
        tracking_window: trackingWindow,
      },
    }),
    [courseId],
  )
}

function buildCountryQueryOptions<TData>(
  courseId: string | null | undefined,
  granularity: TimeGranularity,
  timeWindow: number,
  country: string | null | undefined,
  getGeneratedOptions: (args: ReturnType<typeof withCountry>) => GeneratedOptionsWithKey,
): BuiltQueryOptions<TData> {
  if (courseId != null && country != null) {
    return getGeneratedOptions(
      withCountry(courseId, granularity, timeWindow, country),
    ) as BuiltQueryOptions<TData>
  }

  return buildDisabledQueryOptions<TData>(
    disabledQueryKey(getGeneratedOptions.name, {
      path: {
        course_id: courseId,
        granularity,
        time_window: timeWindow,
        country,
      },
    }),
    [courseId, country],
  )
}

function buildCustomTimePeriodQueryOptions<TData>(
  courseId: string | null | undefined,
  startDate: string,
  endDate: string,
  getGeneratedOptions: (args: ReturnType<typeof withCustomTimePeriod>) => GeneratedOptionsWithKey,
): BuiltQueryOptions<TData> {
  if (courseId != null) {
    return getGeneratedOptions(
      withCustomTimePeriod(courseId, startDate, endDate),
    ) as BuiltQueryOptions<TData>
  }

  return buildDisabledQueryOptions<TData>(
    disabledQueryKey(getGeneratedOptions.name, {
      path: {
        course_id: courseId,
        start_date: startDate,
        end_date: endDate,
      },
    }),
    [courseId],
  )
}

const getTotalUsersStartedCourseOptions = (courseId: string | null | undefined) =>
  buildCourseOnlyQueryOptions(courseId, getTotalUsersStartedCourseGeneratedOptions)

const getTotalUsersCompletedCourseOptions = (courseId: string | null | undefined) =>
  buildCourseOnlyQueryOptions(courseId, getTotalUsersCompletedCourseGeneratedOptions)

const getAvgTimeToFirstSubmissionHistoryOptions = (
  courseId: string | null | undefined,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  buildGranularityAndWindowQueryOptions(
    courseId,
    granularity,
    timeWindow,
    getAvgTimeToFirstSubmissionHistoryGeneratedOptions,
  )

const getTotalUsersReturnedExercisesOptions = (courseId: string | null | undefined) =>
  buildCourseOnlyQueryOptions(courseId, getTotalUsersReturnedExercisesGeneratedOptions)

const getTotalUsersStartedAllLanguageVersionsOptions = (courseId: string | null | undefined) =>
  buildCourseOnlyQueryOptions(courseId, getTotalUsersStartedAllLanguageVersionsGeneratedOptions)

const getCourseCompletionsHistoryOptions = (
  courseId: string | null | undefined,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  buildGranularityAndWindowQueryOptions(
    courseId,
    granularity,
    timeWindow,
    getCourseCompletionsHistoryGeneratedOptions,
  )

const getCourseCompletionsHistoryAllLanguageVersionsOptions = (
  courseId: string | null | undefined,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  buildGranularityAndWindowQueryOptions(
    courseId,
    granularity,
    timeWindow,
    getCourseCompletionsHistoryAllLanguageVersionsGeneratedOptions,
  )

const getUniqueUsersStartingHistoryOptions = (
  courseId: string | null | undefined,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  buildGranularityAndWindowQueryOptions(
    courseId,
    granularity,
    timeWindow,
    getUniqueUsersStartingHistoryGeneratedOptions,
  )

const getCohortActivityHistoryOptions = (
  courseId: string | null | undefined,
  granularity: TimeGranularity,
  historyWindow: number,
  trackingWindow: number,
) =>
  buildHistoryAndTrackingWindowQueryOptions(
    courseId,
    granularity,
    historyWindow,
    trackingWindow,
    getCohortActivityHistoryGeneratedOptions,
  )

const getUsersReturningExercisesHistoryOptions = (
  courseId: string | null | undefined,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  buildGranularityAndWindowQueryOptions(
    courseId,
    granularity,
    timeWindow,
    getUsersReturningExercisesHistoryGeneratedOptions,
  )

const getFirstExerciseSubmissionsHistoryOptions = (
  courseId: string | null | undefined,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  buildGranularityAndWindowQueryOptions(
    courseId,
    granularity,
    timeWindow,
    getFirstExerciseSubmissionsHistoryGeneratedOptions,
  )

const getUniqueUsersStartingHistoryAllLanguageVersionsOptions = (
  courseId: string | null | undefined,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  buildGranularityAndWindowQueryOptions(
    courseId,
    granularity,
    timeWindow,
    getUniqueUsersStartingHistoryAllLanguageVersionsGeneratedOptions,
  )

const getTotalUsersStartedCourseByInstanceOptions = (courseId: string | null | undefined) =>
  buildCourseOnlyQueryOptions(courseId, getTotalUsersStartedCourseByInstanceGeneratedOptions)

const getTotalUsersCompletedCourseByInstanceOptions = (courseId: string | null | undefined) =>
  buildCourseOnlyQueryOptions(courseId, getTotalUsersCompletedCourseByInstanceGeneratedOptions)

const getTotalUsersReturnedExercisesByInstanceOptions = (courseId: string | null | undefined) =>
  buildCourseOnlyQueryOptions(courseId, getTotalUsersReturnedExercisesByInstanceGeneratedOptions)

const getCourseCompletionsHistoryByInstanceOptions = (
  courseId: string | null | undefined,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  buildGranularityAndWindowQueryOptions(
    courseId,
    granularity,
    timeWindow,
    getCourseCompletionsHistoryByInstanceGeneratedOptions,
  )

const getUniqueUsersStartingHistoryByInstanceOptions = (
  courseId: string | null | undefined,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  buildGranularityAndWindowQueryOptions(
    courseId,
    granularity,
    timeWindow,
    getUniqueUsersStartingHistoryByInstanceGeneratedOptions,
  )

const getFirstExerciseSubmissionsHistoryByInstanceOptions = (
  courseId: string | null | undefined,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  buildGranularityAndWindowQueryOptions(
    courseId,
    granularity,
    timeWindow,
    getFirstExerciseSubmissionsHistoryByInstanceGeneratedOptions,
  )

const getUsersReturningExercisesHistoryByInstanceOptions = (
  courseId: string | null | undefined,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  buildGranularityAndWindowQueryOptions(
    courseId,
    granularity,
    timeWindow,
    getUsersReturningExercisesHistoryByInstanceGeneratedOptions,
  )

const getStudentEnrollmentsByCountryOptions = (
  courseId: string | null | undefined,
  granularity: TimeGranularity,
  timeWindow: number,
  country: string | null | undefined,
) =>
  buildCountryQueryOptions(
    courseId,
    granularity,
    timeWindow,
    country,
    getStudentEnrollmentsByCountryGeneratedOptions,
  )

const getStudentCompletionsByCountryOptions = (
  courseId: string | null | undefined,
  granularity: TimeGranularity,
  timeWindow: number,
  country: string | null | undefined,
) =>
  buildCountryQueryOptions(
    courseId,
    granularity,
    timeWindow,
    country,
    getStudentCompletionsByCountryGeneratedOptions,
  )

const getStudentsByCountryTotalsOptions = (courseId: string | null | undefined) =>
  buildCourseOnlyQueryOptions(courseId, getStudentsByCountryTotalsGeneratedOptions)

const getFirstExerciseSubmissionsByModuleOptions = (
  courseId: string | null | undefined,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  buildGranularityAndWindowQueryOptions(
    courseId,
    granularity,
    timeWindow,
    getFirstExerciseSubmissionsByModuleGeneratedOptions,
  )

const getCourseCompletionsHistoryForCustomTimePeriodOptions = (
  courseId: string | null | undefined,
  startDate: string,
  endDate: string,
) =>
  buildCustomTimePeriodQueryOptions(
    courseId,
    startDate,
    endDate,
    getCourseCompletionsHistoryCustomTimePeriodGeneratedOptions,
  )

const getUniqueUsersStartingHistoryCustomTimePeriodOptions = (
  courseId: string | null | undefined,
  startDate: string,
  endDate: string,
) =>
  buildCustomTimePeriodQueryOptions(
    courseId,
    startDate,
    endDate,
    getUniqueUsersStartingHistoryCustomTimePeriodGeneratedOptions,
  )

const getTotalUsersStartedCourseCustomTimePeriodOptions = (
  courseId: string | null | undefined,
  startDate: string,
  endDate: string,
) =>
  buildCustomTimePeriodQueryOptions(
    courseId,
    startDate,
    endDate,
    getTotalUsersStartedCourseCustomTimePeriodGeneratedOptions,
  )

const getTotalUsersCompletedCourseCustomTimePeriodOptions = (
  courseId: string | null | undefined,
  startDate: string,
  endDate: string,
) =>
  buildCustomTimePeriodQueryOptions(
    courseId,
    startDate,
    endDate,
    getTotalUsersCompletedCourseCustomTimePeriodGeneratedOptions,
  )

const getTotalUsersReturnedExercisesCustomTimePeriodOptions = (
  courseId: string | null | undefined,
  startDate: string,
  endDate: string,
) =>
  buildCustomTimePeriodQueryOptions(
    courseId,
    startDate,
    endDate,
    getTotalUsersReturnedExercisesCustomTimePeriodGeneratedOptions,
  )

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
    withGeneratedQueryOptions(getTotalUsersStartedCourseOptions(courseId), !!courseId, options),
  )
}

export const useTotalUsersCompletedCourseQuery = (
  courseId: string | null,
  options: HookQueryOptions<CountResult> = {},
): UseQueryResult<CountResult, Error> => {
  return useQuery<CountResult, Error>(
    withGeneratedQueryOptions(getTotalUsersCompletedCourseOptions(courseId), !!courseId, options),
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
      getUsersReturningExercisesHistoryOptions(courseId, granularity, timeWindow),
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
    withGeneratedQueryOptions(getTotalUsersReturnedExercisesOptions(courseId), !!courseId, options),
  )
}

export const useTotalUsersStartedAllLanguageVersionsQuery = (
  courseId: string | null,
  options: HookQueryOptions<CountResult> = {},
): UseQueryResult<CountResult, Error> => {
  return useQuery<CountResult, Error>(
    withGeneratedQueryOptions(
      getTotalUsersStartedAllLanguageVersionsOptions(courseId),
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
      getCourseCompletionsHistoryOptions(courseId, granularity, timeWindow),
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
      getCourseCompletionsHistoryAllLanguageVersionsOptions(courseId, granularity, timeWindow),
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
      getUniqueUsersStartingHistoryOptions(courseId, granularity, timeWindow),
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
      getCohortActivityHistoryOptions(courseId, granularity, historyWindow, trackingWindow),
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
      getFirstExerciseSubmissionsHistoryOptions(courseId, granularity, timeWindow),
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
      getUniqueUsersStartingHistoryAllLanguageVersionsOptions(courseId, granularity, timeWindow),
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
      getAvgTimeToFirstSubmissionHistoryOptions(courseId, granularity, timeWindow),
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
      getTotalUsersStartedCourseByInstanceOptions(courseId),
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
      getTotalUsersCompletedCourseByInstanceOptions(courseId),
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
      getTotalUsersReturnedExercisesByInstanceOptions(courseId),
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
      getCourseCompletionsHistoryByInstanceOptions(courseId, granularity, timeWindow),
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
      getUniqueUsersStartingHistoryByInstanceOptions(courseId, granularity, timeWindow),
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
      getFirstExerciseSubmissionsHistoryByInstanceOptions(courseId, granularity, timeWindow),
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
      getUsersReturningExercisesHistoryByInstanceOptions(courseId, granularity, timeWindow),
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
      getStudentEnrollmentsByCountryOptions(courseId, granularity, timeWindow, country),
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
      getStudentCompletionsByCountryOptions(courseId, granularity, timeWindow, country),
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
      getCourseCompletionsHistoryForCustomTimePeriodOptions(courseId, startDate, endDate),
      !!courseId && !!startDate && !!endDate,
      options,
    ),
  )
}

export const useStudentsByCountryTotalsQuery = (
  courseId: string | null,
): UseQueryResult<StudentsByCountryTotalsResult[], Error> => {
  return useQuery<StudentsByCountryTotalsResult[], Error>(
    withGeneratedQueryOptions(getStudentsByCountryTotalsOptions(courseId), !!courseId),
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
      getFirstExerciseSubmissionsByModuleOptions(courseId, granularity, timeWindow),
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
      getUniqueUsersStartingHistoryCustomTimePeriodOptions(courseId, startDate, endDate),
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
      getTotalUsersStartedCourseCustomTimePeriodOptions(courseId, startDate, endDate),
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
      getTotalUsersCompletedCourseCustomTimePeriodOptions(courseId, startDate, endDate),
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
      getTotalUsersReturnedExercisesCustomTimePeriodOptions(courseId, startDate, endDate),
      !!courseId && !!startDate && !!endDate,
      options,
    ),
  )
}
