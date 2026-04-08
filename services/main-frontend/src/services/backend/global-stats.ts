import { queryOptions } from "@tanstack/react-query"

import {
  getCompletionStatsByEmailDomainOptions as getCompletionStatsByEmailDomainGeneratedOptions,
  getCourseCompletionStatsForEmailDomainOptions as getCourseCompletionStatsForEmailDomainGeneratedOptions,
  getCourseModuleStatsByCompletionsRegisteredToStudyRegistryOptions as getCourseModuleStatsByCompletionsRegisteredToStudyRegistryGeneratedOptions,
  getNumberOfPeopleCompletedACourseOptions as getNumberOfPeopleCompletedACourseGeneratedOptions,
  getNumberOfPeopleDoneAtLeastOneExerciseOptions as getNumberOfPeopleDoneAtLeastOneExerciseGeneratedOptions,
  getNumberOfPeopleRegisteredCompletionToStudyRegistryOptions as getNumberOfPeopleRegisteredCompletionToStudyRegistryGeneratedOptions,
  getNumberOfPeopleStartedCourseOptions as getNumberOfPeopleStartedCourseGeneratedOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  getCompletionStatsByEmailDomain as getCompletionStatsByEmailDomainFromApi,
  getCourseCompletionStatsForEmailDomain as getCourseCompletionStatsForEmailDomainFromApi,
  getCourseModuleStatsByCompletionsRegisteredToStudyRegistry as getCourseModuleStatsByCompletionsRegisteredToStudyRegistryFromApi,
  getNumberOfPeopleCompletedACourse as getNumberOfPeopleCompletedACourseFromApi,
  getNumberOfPeopleDoneAtLeastOneExercise as getNumberOfPeopleDoneAtLeastOneExerciseFromApi,
  getNumberOfPeopleRegisteredCompletionToStudyRegistry as getNumberOfPeopleRegisteredCompletionToStudyRegistryFromApi,
  getNumberOfPeopleStartedCourse as getNumberOfPeopleStartedCourseFromApi,
} from "@/generated/api/sdk.generated"
import {
  CourseCompletionStats,
  DomainCompletionStats,
  GlobalCourseModuleStatEntry,
  GlobalStatEntry,
  TimeGranularity,
} from "@/shared-module/common/bindings"
import {
  isCourseCompletionStats,
  isDomainCompletionStats,
  isGlobalCourseModuleStatEntry,
  isGlobalStatEntry,
} from "@/shared-module/common/bindings.guard"
import { isArray } from "@/shared-module/common/utils/fetching"

const validateGeneratedData = <T>(data: unknown, isT: (value: unknown) => value is T): T => {
  if (isT(data)) {
    return data
  }

  throw new Error(`Invalid data from API: ${JSON.stringify(data, undefined, 2)}`)
}

export const getNumberOfPeopleCompletedACourse = async (
  granularity: TimeGranularity,
): Promise<GlobalStatEntry[]> => {
  const data = await getNumberOfPeopleCompletedACourseFromApi({
    query: { granularity },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isGlobalStatEntry))
}

export const getNumberOfPeopleCompletedACourseOptions = (granularity: TimeGranularity) =>
  queryOptions({
    ...getNumberOfPeopleCompletedACourseGeneratedOptions({
      query: { granularity },
    }),
    select: (data): GlobalStatEntry[] => validateGeneratedData(data, isArray(isGlobalStatEntry)),
  })

export const getNumberOfPeopleRegisteredCompletionToStudyRegistry = async (
  granularity: TimeGranularity,
): Promise<GlobalStatEntry[]> => {
  const data = await getNumberOfPeopleRegisteredCompletionToStudyRegistryFromApi({
    query: { granularity },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isGlobalStatEntry))
}

export const getNumberOfPeopleRegisteredCompletionToStudyRegistryOptions = (
  granularity: TimeGranularity,
) =>
  queryOptions({
    ...getNumberOfPeopleRegisteredCompletionToStudyRegistryGeneratedOptions({
      query: { granularity },
    }),
    select: (data): GlobalStatEntry[] => validateGeneratedData(data, isArray(isGlobalStatEntry)),
  })

export const getNumberOfPeopleDoneAtLeastOneExercise = async (
  granularity: TimeGranularity,
): Promise<GlobalStatEntry[]> => {
  const data = await getNumberOfPeopleDoneAtLeastOneExerciseFromApi({
    query: { granularity },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isGlobalStatEntry))
}

export const getNumberOfPeopleDoneAtLeastOneExerciseOptions = (granularity: TimeGranularity) =>
  queryOptions({
    ...getNumberOfPeopleDoneAtLeastOneExerciseGeneratedOptions({
      query: { granularity },
    }),
    select: (data): GlobalStatEntry[] => validateGeneratedData(data, isArray(isGlobalStatEntry)),
  })

export const getNumberOfPeopleStartedCourse = async (
  granularity: TimeGranularity,
): Promise<GlobalStatEntry[]> => {
  const data = await getNumberOfPeopleStartedCourseFromApi({
    query: { granularity },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isGlobalStatEntry))
}

export const getNumberOfPeopleStartedCourseOptions = (granularity: TimeGranularity) =>
  queryOptions({
    ...getNumberOfPeopleStartedCourseGeneratedOptions({
      query: { granularity },
    }),
    select: (data): GlobalStatEntry[] => validateGeneratedData(data, isArray(isGlobalStatEntry)),
  })

export const getnumberOfPeopleStartedCourse = getNumberOfPeopleStartedCourse

export const getCourseModuleStatsByCompletionsRegisteredToStudyRegistry = async (
  granularity: TimeGranularity,
): Promise<GlobalCourseModuleStatEntry[]> => {
  const data = await getCourseModuleStatsByCompletionsRegisteredToStudyRegistryFromApi({
    query: { granularity },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isGlobalCourseModuleStatEntry))
}

export const getCourseModuleStatsByCompletionsRegisteredToStudyRegistryOptions = (
  granularity: TimeGranularity,
) =>
  queryOptions({
    ...getCourseModuleStatsByCompletionsRegisteredToStudyRegistryGeneratedOptions({
      query: { granularity },
    }),
    select: (data): GlobalCourseModuleStatEntry[] =>
      validateGeneratedData(data, isArray(isGlobalCourseModuleStatEntry)),
  })

export const getCompletionStatsByEmailDomain = async (
  year?: number,
): Promise<DomainCompletionStats[]> => {
  const data = await getCompletionStatsByEmailDomainFromApi({
    query: year === undefined ? undefined : { year },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isDomainCompletionStats))
}

export const getCompletionStatsByEmailDomainOptions = (year?: number) =>
  queryOptions({
    ...getCompletionStatsByEmailDomainGeneratedOptions(
      year === undefined ? undefined : { query: { year } },
    ),
    select: (data): DomainCompletionStats[] =>
      validateGeneratedData(data, isArray(isDomainCompletionStats)),
  })

export const getCourseCompletionStatsForEmailDomain = async (
  emailDomain: string,
  year?: number,
): Promise<CourseCompletionStats[]> => {
  const data = await getCourseCompletionStatsForEmailDomainFromApi({
    query: {
      email_domain: emailDomain,
      year,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCourseCompletionStats))
}

export const getCourseCompletionStatsForEmailDomainOptions = (emailDomain: string, year?: number) =>
  queryOptions({
    ...getCourseCompletionStatsForEmailDomainGeneratedOptions({
      query: {
        email_domain: emailDomain,
        year,
      },
    }),
    select: (data): CourseCompletionStats[] =>
      validateGeneratedData(data, isArray(isCourseCompletionStats)),
  })
