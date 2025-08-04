import { useQuery, UseQueryResult } from "@tanstack/react-query"

import {
  getCompletionStatsByEmailDomain,
  getCourseCompletionStatsForEmailDomain,
  getCourseModuleStatsByCompletionsRegisteredToStudyRegistry,
  getNumberOfPeopleCompletedACourse,
  getNumberOfPeopleDoneAtLeastOneExercise,
  getNumberOfPeopleRegisteredCompletionToStudyRegistry,
  getnumberOfPeopleStartedCourse,
} from "../services/backend/global-stats"

import { HookQueryOptions } from "."

import {
  CourseCompletionStats,
  DomainCompletionStats,
  GlobalCourseModuleStatEntry,
  GlobalStatEntry,
  TimeGranularity,
} from "@/shared-module/common/bindings"

export const useNumberOfPeopleCompletedACourseQuery = (
  granularity: TimeGranularity,
  options: HookQueryOptions<GlobalStatEntry[]> = {},
): UseQueryResult<GlobalStatEntry[], Error> => {
  return useQuery({
    queryKey: ["numberOfPeopleComplatedACourse", granularity],
    queryFn: () => getNumberOfPeopleCompletedACourse(granularity),
    ...options,
  })
}

export const useNumberOfPeopleRegisteredCompletionToStudyRegistryQuery = (
  granularity: TimeGranularity,
  options: HookQueryOptions<GlobalStatEntry[]> = {},
): UseQueryResult<GlobalStatEntry[], Error> => {
  return useQuery({
    queryKey: ["numberOfPeopleRegisteredCompletionToStudyRegistry", granularity],
    queryFn: () => getNumberOfPeopleRegisteredCompletionToStudyRegistry(granularity),
    ...options,
  })
}

export const useNumberOfPeopleDoneAtLeastOneExerciseQuery = (
  granularity: TimeGranularity,
  options: HookQueryOptions<GlobalStatEntry[]> = {},
): UseQueryResult<GlobalStatEntry[], Error> => {
  return useQuery({
    queryKey: ["numberOfPeopleDoneAtLeastOneExercise", granularity],
    queryFn: () => getNumberOfPeopleDoneAtLeastOneExercise(granularity),
    ...options,
  })
}

export const useNumberOfPeopleStartedCourseQuery = (
  granularity: TimeGranularity,
  options: HookQueryOptions<GlobalStatEntry[]> = {},
): UseQueryResult<GlobalStatEntry[], Error> => {
  return useQuery({
    queryKey: ["numberOfPeopleStartedCourse", granularity],
    queryFn: () => getnumberOfPeopleStartedCourse(granularity),
    ...options,
  })
}

export const useCourseModuleStatsByCompletionsRegisteredToStudyRegistryQuery = (
  granularity: TimeGranularity,
  options: HookQueryOptions<GlobalCourseModuleStatEntry[]> = {},
): UseQueryResult<GlobalCourseModuleStatEntry[], Error> => {
  return useQuery({
    queryKey: ["courseModuleStatsByCompletionsReqisteredToStudyRegistry", granularity],
    queryFn: () => getCourseModuleStatsByCompletionsRegisteredToStudyRegistry(granularity),
    ...options,
  })
}

export const useCompletionStatsByEmailDomainQuery = (
  year: number | undefined,
  options: HookQueryOptions<DomainCompletionStats[]> = {},
): UseQueryResult<DomainCompletionStats[], Error> => {
  return useQuery<DomainCompletionStats[], Error>({
    queryKey: ["global-stats", "completion-stats-by-email-domain", year],
    queryFn: () => getCompletionStatsByEmailDomain(year),
    ...options,
  })
}

export const useCourseCompletionStatsForEmailDomainQuery = (
  emailDomain: string,
  year: number | undefined,
  options: HookQueryOptions<CourseCompletionStats[]> = {},
): UseQueryResult<CourseCompletionStats[], Error> => {
  return useQuery<CourseCompletionStats[], Error>({
    queryKey: ["global-stats", "course-completion-stats-for-email-domain", emailDomain, year],
    queryFn: () => getCourseCompletionStatsForEmailDomain(emailDomain, year),
    ...options,
  })
}
