import { queryOptions } from "@tanstack/react-query"

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
  getAvgTimeToFirstSubmissionHistory as getAvgTimeToFirstSubmissionHistoryFromApi,
  getCohortActivityHistory as getCohortActivityHistoryFromApi,
  getCourseCompletionsHistoryAllLanguageVersions as getCourseCompletionsHistoryAllLanguageVersionsFromApi,
  getCourseCompletionsHistoryByInstance as getCourseCompletionsHistoryByInstanceFromApi,
  getCourseCompletionsHistoryCustomTimePeriod as getCourseCompletionsHistoryCustomTimePeriodFromApi,
  getCourseCompletionsHistory as getCourseCompletionsHistoryFromApi,
  getFirstExerciseSubmissionsByModule as getFirstExerciseSubmissionsByModuleFromApi,
  getFirstExerciseSubmissionsHistoryByInstance as getFirstExerciseSubmissionsHistoryByInstanceFromApi,
  getFirstExerciseSubmissionsHistory as getFirstExerciseSubmissionsHistoryFromApi,
  getStudentCompletionsByCountry as getStudentCompletionsByCountryFromApi,
  getStudentEnrollmentsByCountry as getStudentEnrollmentsByCountryFromApi,
  getStudentsByCountryTotals as getStudentsByCountryTotalsFromApi,
  getTotalUsersCompletedCourseByInstance as getTotalUsersCompletedCourseByInstanceFromApi,
  getTotalUsersCompletedCourseCustomTimePeriod as getTotalUsersCompletedCourseCustomTimePeriodFromApi,
  getTotalUsersCompletedCourse as getTotalUsersCompletedCourseFromApi,
  getTotalUsersReturnedExercisesByInstance as getTotalUsersReturnedExercisesByInstanceFromApi,
  getTotalUsersReturnedExercisesCustomTimePeriod as getTotalUsersReturnedExercisesCustomTimePeriodFromApi,
  getTotalUsersReturnedExercises as getTotalUsersReturnedExercisesFromApi,
  getTotalUsersStartedAllLanguageVersions as getTotalUsersStartedAllLanguageVersionsFromApi,
  getTotalUsersStartedCourseByInstance as getTotalUsersStartedCourseByInstanceFromApi,
  getTotalUsersStartedCourseCustomTimePeriod as getTotalUsersStartedCourseCustomTimePeriodFromApi,
  getTotalUsersStartedCourse as getTotalUsersStartedCourseFromApi,
  getUniqueUsersStartingHistoryAllLanguageVersions as getUniqueUsersStartingHistoryAllLanguageVersionsFromApi,
  getUniqueUsersStartingHistoryByInstance as getUniqueUsersStartingHistoryByInstanceFromApi,
  getUniqueUsersStartingHistoryCustomTimePeriod as getUniqueUsersStartingHistoryCustomTimePeriodFromApi,
  getUniqueUsersStartingHistory as getUniqueUsersStartingHistoryFromApi,
  getUsersReturningExercisesHistoryByInstance as getUsersReturningExercisesHistoryByInstanceFromApi,
  getUsersReturningExercisesHistory as getUsersReturningExercisesHistoryFromApi,
} from "@/generated/api/sdk.generated"
import {
  AverageMetric,
  CohortActivity,
  CountResult,
  StudentsByCountryTotalsResult,
  TimeGranularity,
} from "@/shared-module/common/bindings"
import {
  isAverageMetric,
  isCohortActivity,
  isCountResult,
  isStudentsByCountryTotalsResult,
} from "@/shared-module/common/bindings.guard"
import { isArray, isObjectMap } from "@/shared-module/common/utils/fetching"

const validateGeneratedData = <T>(data: unknown, isT: (value: unknown) => value is T): T => {
  if (isT(data)) {
    return data
  }

  throw new Error(`Invalid data from API: ${JSON.stringify(data, undefined, 2)}`)
}

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

export const getTotalUsersStartedCourse = async (courseId: string): Promise<CountResult> => {
  const data = await getTotalUsersStartedCourseFromApi({
    ...withCourseId(courseId),
    throwOnError: true,
  })

  return validateGeneratedData(data, isCountResult)
}

export const getTotalUsersStartedCourseOptions = (courseId: string) =>
  queryOptions({
    ...getTotalUsersStartedCourseGeneratedOptions(withCourseId(courseId)),
    select: (data): CountResult => validateGeneratedData(data, isCountResult),
  })

export const getTotalUsersCompletedCourse = async (courseId: string): Promise<CountResult> => {
  const data = await getTotalUsersCompletedCourseFromApi({
    ...withCourseId(courseId),
    throwOnError: true,
  })

  return validateGeneratedData(data, isCountResult)
}

export const getTotalUsersCompletedCourseOptions = (courseId: string) =>
  queryOptions({
    ...getTotalUsersCompletedCourseGeneratedOptions(withCourseId(courseId)),
    select: (data): CountResult => validateGeneratedData(data, isCountResult),
  })

export const getAvgTimeToFirstSubmissionHistory = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<AverageMetric[]> => {
  const data = await getAvgTimeToFirstSubmissionHistoryFromApi({
    ...withGranularityAndWindow(courseId, granularity, timeWindow),
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isAverageMetric))
}

export const getAvgTimeToFirstSubmissionHistoryOptions = (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  queryOptions({
    ...getAvgTimeToFirstSubmissionHistoryGeneratedOptions(
      withGranularityAndWindow(courseId, granularity, timeWindow),
    ),
    select: (data): AverageMetric[] => validateGeneratedData(data, isArray(isAverageMetric)),
  })

export const getTotalUsersReturnedExercises = async (courseId: string): Promise<CountResult> => {
  const data = await getTotalUsersReturnedExercisesFromApi({
    ...withCourseId(courseId),
    throwOnError: true,
  })

  return validateGeneratedData(data, isCountResult)
}

export const getTotalUsersReturnedExercisesOptions = (courseId: string) =>
  queryOptions({
    ...getTotalUsersReturnedExercisesGeneratedOptions(withCourseId(courseId)),
    select: (data): CountResult => validateGeneratedData(data, isCountResult),
  })

export const getTotalUsersStartedAllLanguageVersions = async (
  courseId: string,
): Promise<CountResult> => {
  const data = await getTotalUsersStartedAllLanguageVersionsFromApi({
    ...withCourseId(courseId),
    throwOnError: true,
  })

  return validateGeneratedData(data, isCountResult)
}

export const getTotalUsersStartedAllLanguageVersionsOptions = (courseId: string) =>
  queryOptions({
    ...getTotalUsersStartedAllLanguageVersionsGeneratedOptions(withCourseId(courseId)),
    select: (data): CountResult => validateGeneratedData(data, isCountResult),
  })

export const getCourseCompletionsHistory = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<CountResult[]> => {
  const data = await getCourseCompletionsHistoryFromApi({
    ...withGranularityAndWindow(courseId, granularity, timeWindow),
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCountResult))
}

export const getCourseCompletionsHistoryOptions = (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  queryOptions({
    ...getCourseCompletionsHistoryGeneratedOptions(
      withGranularityAndWindow(courseId, granularity, timeWindow),
    ),
    select: (data): CountResult[] => validateGeneratedData(data, isArray(isCountResult)),
  })

export const getCourseCompletionsHistoryAllLanguageVersions = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<CountResult[]> => {
  const data = await getCourseCompletionsHistoryAllLanguageVersionsFromApi({
    ...withGranularityAndWindow(courseId, granularity, timeWindow),
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCountResult))
}

export const getCourseCompletionsHistoryAllLanguageVersionsOptions = (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  queryOptions({
    ...getCourseCompletionsHistoryAllLanguageVersionsGeneratedOptions(
      withGranularityAndWindow(courseId, granularity, timeWindow),
    ),
    select: (data): CountResult[] => validateGeneratedData(data, isArray(isCountResult)),
  })

export const getUniqueUsersStartingHistory = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<CountResult[]> => {
  const data = await getUniqueUsersStartingHistoryFromApi({
    ...withGranularityAndWindow(courseId, granularity, timeWindow),
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCountResult))
}

export const getUniqueUsersStartingHistoryOptions = (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  queryOptions({
    ...getUniqueUsersStartingHistoryGeneratedOptions(
      withGranularityAndWindow(courseId, granularity, timeWindow),
    ),
    select: (data): CountResult[] => validateGeneratedData(data, isArray(isCountResult)),
  })

export const getUniqueUsersStartingHistoryAllLanguageVersions = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<CountResult[]> => {
  const data = await getUniqueUsersStartingHistoryAllLanguageVersionsFromApi({
    ...withGranularityAndWindow(courseId, granularity, timeWindow),
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCountResult))
}

export const getUniqueUsersStartingHistoryAllLanguageVersionsOptions = (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  queryOptions({
    ...getUniqueUsersStartingHistoryAllLanguageVersionsGeneratedOptions(
      withGranularityAndWindow(courseId, granularity, timeWindow),
    ),
    select: (data): CountResult[] => validateGeneratedData(data, isArray(isCountResult)),
  })

export const getCohortActivityHistory = async (
  courseId: string,
  granularity: TimeGranularity,
  historyWindow: number,
  trackingWindow: number,
): Promise<CohortActivity[]> => {
  const data = await getCohortActivityHistoryFromApi({
    ...withHistoryAndTrackingWindow(courseId, granularity, historyWindow, trackingWindow),
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCohortActivity))
}

export const getCohortActivityHistoryOptions = (
  courseId: string,
  granularity: TimeGranularity,
  historyWindow: number,
  trackingWindow: number,
) =>
  queryOptions({
    ...getCohortActivityHistoryGeneratedOptions(
      withHistoryAndTrackingWindow(courseId, granularity, historyWindow, trackingWindow),
    ),
    select: (data): CohortActivity[] => validateGeneratedData(data, isArray(isCohortActivity)),
  })

export const getUsersReturningExercisesHistory = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<CountResult[]> => {
  const data = await getUsersReturningExercisesHistoryFromApi({
    ...withGranularityAndWindow(courseId, granularity, timeWindow),
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCountResult))
}

export const getUsersReturningExercisesHistoryOptions = (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  queryOptions({
    ...getUsersReturningExercisesHistoryGeneratedOptions(
      withGranularityAndWindow(courseId, granularity, timeWindow),
    ),
    select: (data): CountResult[] => validateGeneratedData(data, isArray(isCountResult)),
  })

export const getFirstExerciseSubmissionsHistory = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<CountResult[]> => {
  const data = await getFirstExerciseSubmissionsHistoryFromApi({
    ...withGranularityAndWindow(courseId, granularity, timeWindow),
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCountResult))
}

export const getFirstExerciseSubmissionsHistoryOptions = (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  queryOptions({
    ...getFirstExerciseSubmissionsHistoryGeneratedOptions(
      withGranularityAndWindow(courseId, granularity, timeWindow),
    ),
    select: (data): CountResult[] => validateGeneratedData(data, isArray(isCountResult)),
  })

export const getTotalUsersStartedCourseByInstance = async (
  courseId: string,
): Promise<Record<string, CountResult>> => {
  const data = await getTotalUsersStartedCourseByInstanceFromApi({
    ...withCourseId(courseId),
    throwOnError: true,
  })

  return validateGeneratedData(data, isObjectMap(isCountResult))
}

export const getTotalUsersStartedCourseByInstanceOptions = (courseId: string) =>
  queryOptions({
    ...getTotalUsersStartedCourseByInstanceGeneratedOptions(withCourseId(courseId)),
    select: (data): Record<string, CountResult> =>
      validateGeneratedData(data, isObjectMap(isCountResult)),
  })

export const getTotalUsersCompletedCourseByInstance = async (
  courseId: string,
): Promise<Record<string, CountResult>> => {
  const data = await getTotalUsersCompletedCourseByInstanceFromApi({
    ...withCourseId(courseId),
    throwOnError: true,
  })

  return validateGeneratedData(data, isObjectMap(isCountResult))
}

export const getTotalUsersCompletedCourseByInstanceOptions = (courseId: string) =>
  queryOptions({
    ...getTotalUsersCompletedCourseByInstanceGeneratedOptions(withCourseId(courseId)),
    select: (data): Record<string, CountResult> =>
      validateGeneratedData(data, isObjectMap(isCountResult)),
  })

export const getTotalUsersReturnedExercisesByInstance = async (
  courseId: string,
): Promise<Record<string, CountResult>> => {
  const data = await getTotalUsersReturnedExercisesByInstanceFromApi({
    ...withCourseId(courseId),
    throwOnError: true,
  })

  return validateGeneratedData(data, isObjectMap(isCountResult))
}

export const getTotalUsersReturnedExercisesByInstanceOptions = (courseId: string) =>
  queryOptions({
    ...getTotalUsersReturnedExercisesByInstanceGeneratedOptions(withCourseId(courseId)),
    select: (data): Record<string, CountResult> =>
      validateGeneratedData(data, isObjectMap(isCountResult)),
  })

export const getCourseCompletionsHistoryByInstance = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<Record<string, CountResult[]>> => {
  const data = await getCourseCompletionsHistoryByInstanceFromApi({
    ...withGranularityAndWindow(courseId, granularity, timeWindow),
    throwOnError: true,
  })

  return validateGeneratedData(data, isObjectMap(isArray(isCountResult)))
}

export const getCourseCompletionsHistoryByInstanceOptions = (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  queryOptions({
    ...getCourseCompletionsHistoryByInstanceGeneratedOptions(
      withGranularityAndWindow(courseId, granularity, timeWindow),
    ),
    select: (data): Record<string, CountResult[]> =>
      validateGeneratedData(data, isObjectMap(isArray(isCountResult))),
  })

export const getUniqueUsersStartingHistoryByInstance = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<Record<string, CountResult[]>> => {
  const data = await getUniqueUsersStartingHistoryByInstanceFromApi({
    ...withGranularityAndWindow(courseId, granularity, timeWindow),
    throwOnError: true,
  })

  return validateGeneratedData(data, isObjectMap(isArray(isCountResult)))
}

export const getUniqueUsersStartingHistoryByInstanceOptions = (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  queryOptions({
    ...getUniqueUsersStartingHistoryByInstanceGeneratedOptions(
      withGranularityAndWindow(courseId, granularity, timeWindow),
    ),
    select: (data): Record<string, CountResult[]> =>
      validateGeneratedData(data, isObjectMap(isArray(isCountResult))),
  })

export const getFirstExerciseSubmissionsHistoryByInstance = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<Record<string, CountResult[]>> => {
  const data = await getFirstExerciseSubmissionsHistoryByInstanceFromApi({
    ...withGranularityAndWindow(courseId, granularity, timeWindow),
    throwOnError: true,
  })

  return validateGeneratedData(data, isObjectMap(isArray(isCountResult)))
}

export const getFirstExerciseSubmissionsHistoryByInstanceOptions = (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  queryOptions({
    ...getFirstExerciseSubmissionsHistoryByInstanceGeneratedOptions(
      withGranularityAndWindow(courseId, granularity, timeWindow),
    ),
    select: (data): Record<string, CountResult[]> =>
      validateGeneratedData(data, isObjectMap(isArray(isCountResult))),
  })

export const getUsersReturningExercisesHistoryByInstance = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<Record<string, CountResult[]>> => {
  const data = await getUsersReturningExercisesHistoryByInstanceFromApi({
    ...withGranularityAndWindow(courseId, granularity, timeWindow),
    throwOnError: true,
  })

  return validateGeneratedData(data, isObjectMap(isArray(isCountResult)))
}

export const getUsersReturningExercisesHistoryByInstanceOptions = (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  queryOptions({
    ...getUsersReturningExercisesHistoryByInstanceGeneratedOptions(
      withGranularityAndWindow(courseId, granularity, timeWindow),
    ),
    select: (data): Record<string, CountResult[]> =>
      validateGeneratedData(data, isObjectMap(isArray(isCountResult))),
  })

export const getStudentEnrollmentsByCountry = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
  country: string,
): Promise<CountResult[]> => {
  const data = await getStudentEnrollmentsByCountryFromApi({
    ...withCountry(courseId, granularity, timeWindow, country),
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCountResult))
}

export const getStudentEnrollmentsByCountryOptions = (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
  country: string,
) =>
  queryOptions({
    ...getStudentEnrollmentsByCountryGeneratedOptions(
      withCountry(courseId, granularity, timeWindow, country),
    ),
    select: (data): CountResult[] => validateGeneratedData(data, isArray(isCountResult)),
  })

export const getStudentCompletionsByCountry = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
  country: string,
): Promise<CountResult[]> => {
  const data = await getStudentCompletionsByCountryFromApi({
    ...withCountry(courseId, granularity, timeWindow, country),
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCountResult))
}

export const getStudentCompletionsByCountryOptions = (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
  country: string,
) =>
  queryOptions({
    ...getStudentCompletionsByCountryGeneratedOptions(
      withCountry(courseId, granularity, timeWindow, country),
    ),
    select: (data): CountResult[] => validateGeneratedData(data, isArray(isCountResult)),
  })

export const getStudentsByCountryTotals = async (
  courseId: string,
): Promise<StudentsByCountryTotalsResult[]> => {
  const data = await getStudentsByCountryTotalsFromApi({
    ...withCourseId(courseId),
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isStudentsByCountryTotalsResult))
}

export const getStudentsByCountryTotalsOptions = (courseId: string) =>
  queryOptions({
    ...getStudentsByCountryTotalsGeneratedOptions(withCourseId(courseId)),
    select: (data): StudentsByCountryTotalsResult[] =>
      validateGeneratedData(data, isArray(isStudentsByCountryTotalsResult)),
  })

export const getFirstExerciseSubmissionsByModule = async (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
): Promise<Record<string, CountResult[]>> => {
  const data = await getFirstExerciseSubmissionsByModuleFromApi({
    ...withGranularityAndWindow(courseId, granularity, timeWindow),
    throwOnError: true,
  })

  return validateGeneratedData(data, isObjectMap(isArray(isCountResult)))
}

export const getFirstExerciseSubmissionsByModuleOptions = (
  courseId: string,
  granularity: TimeGranularity,
  timeWindow: number,
) =>
  queryOptions({
    ...getFirstExerciseSubmissionsByModuleGeneratedOptions(
      withGranularityAndWindow(courseId, granularity, timeWindow),
    ),
    select: (data): Record<string, CountResult[]> =>
      validateGeneratedData(data, isObjectMap(isArray(isCountResult))),
  })

export const getCourseCompletionsHistoryForCustomTimePeriod = async (
  courseId: string,
  startDate: string,
  endDate: string,
): Promise<CountResult[]> => {
  const data = await getCourseCompletionsHistoryCustomTimePeriodFromApi({
    ...withCustomTimePeriod(courseId, startDate, endDate),
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCountResult))
}

export const getCourseCompletionsHistoryForCustomTimePeriodOptions = (
  courseId: string,
  startDate: string,
  endDate: string,
) =>
  queryOptions({
    ...getCourseCompletionsHistoryCustomTimePeriodGeneratedOptions(
      withCustomTimePeriod(courseId, startDate, endDate),
    ),
    select: (data): CountResult[] => validateGeneratedData(data, isArray(isCountResult)),
  })

export const getUniqueUsersStartingHistoryCustomTimePeriod = async (
  courseId: string,
  startDate: string,
  endDate: string,
): Promise<CountResult[]> => {
  const data = await getUniqueUsersStartingHistoryCustomTimePeriodFromApi({
    ...withCustomTimePeriod(courseId, startDate, endDate),
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCountResult))
}

export const getUniqueUsersStartingHistoryCustomTimePeriodOptions = (
  courseId: string,
  startDate: string,
  endDate: string,
) =>
  queryOptions({
    ...getUniqueUsersStartingHistoryCustomTimePeriodGeneratedOptions(
      withCustomTimePeriod(courseId, startDate, endDate),
    ),
    select: (data): CountResult[] => validateGeneratedData(data, isArray(isCountResult)),
  })

export const getTotalUsersStartedCourseCustomTimePeriod = async (
  courseId: string,
  startDate: string,
  endDate: string,
): Promise<CountResult> => {
  const data = await getTotalUsersStartedCourseCustomTimePeriodFromApi({
    ...withCustomTimePeriod(courseId, startDate, endDate),
    throwOnError: true,
  })

  return validateGeneratedData(data, isCountResult)
}

export const getTotalUsersStartedCourseCustomTimePeriodOptions = (
  courseId: string,
  startDate: string,
  endDate: string,
) =>
  queryOptions({
    ...getTotalUsersStartedCourseCustomTimePeriodGeneratedOptions(
      withCustomTimePeriod(courseId, startDate, endDate),
    ),
    select: (data): CountResult => validateGeneratedData(data, isCountResult),
  })

export const getTotalUsersCompletedCourseCustomTimePeriod = async (
  courseId: string,
  startDate: string,
  endDate: string,
): Promise<CountResult> => {
  const data = await getTotalUsersCompletedCourseCustomTimePeriodFromApi({
    ...withCustomTimePeriod(courseId, startDate, endDate),
    throwOnError: true,
  })

  return validateGeneratedData(data, isCountResult)
}

export const getTotalUsersCompletedCourseCustomTimePeriodOptions = (
  courseId: string,
  startDate: string,
  endDate: string,
) =>
  queryOptions({
    ...getTotalUsersCompletedCourseCustomTimePeriodGeneratedOptions(
      withCustomTimePeriod(courseId, startDate, endDate),
    ),
    select: (data): CountResult => validateGeneratedData(data, isCountResult),
  })

export const getTotalUsersReturnedExercisesCustomTimePeriod = async (
  courseId: string,
  startDate: string,
  endDate: string,
): Promise<CountResult> => {
  const data = await getTotalUsersReturnedExercisesCustomTimePeriodFromApi({
    ...withCustomTimePeriod(courseId, startDate, endDate),
    throwOnError: true,
  })

  return validateGeneratedData(data, isCountResult)
}

export const getTotalUsersReturnedExercisesCustomTimePeriodOptions = (
  courseId: string,
  startDate: string,
  endDate: string,
) =>
  queryOptions({
    ...getTotalUsersReturnedExercisesCustomTimePeriodGeneratedOptions(
      withCustomTimePeriod(courseId, startDate, endDate),
    ),
    select: (data): CountResult => validateGeneratedData(data, isCountResult),
  })
