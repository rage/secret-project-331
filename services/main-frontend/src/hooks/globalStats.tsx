"use client"

import { useQuery } from "@tanstack/react-query"

import {
  getCompletionStatsByEmailDomainOptions,
  getCourseCompletionStatsForEmailDomainOptions,
  getCourseModuleStatsByCompletionsRegisteredToStudyRegistryOptions,
  getNumberOfPeopleCompletedACourseOptions,
  getNumberOfPeopleDoneAtLeastOneExerciseOptions,
  getNumberOfPeopleRegisteredCompletionToStudyRegistryOptions,
  getNumberOfPeopleStartedCourseOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { TimeGranularity } from "@/generated/api/types.generated"

export const useNumberOfPeopleCompletedACourseQuery = (granularity: TimeGranularity) => {
  return useQuery({
    ...getNumberOfPeopleCompletedACourseOptions({
      query: { granularity },
    }),
  })
}

export const useNumberOfPeopleRegisteredCompletionToStudyRegistryQuery = (
  granularity: TimeGranularity,
) => {
  return useQuery({
    ...getNumberOfPeopleRegisteredCompletionToStudyRegistryOptions({
      query: { granularity },
    }),
  })
}

export const useNumberOfPeopleDoneAtLeastOneExerciseQuery = (granularity: TimeGranularity) => {
  return useQuery({
    ...getNumberOfPeopleDoneAtLeastOneExerciseOptions({
      query: { granularity },
    }),
  })
}

export const useNumberOfPeopleStartedCourseQuery = (granularity: TimeGranularity) => {
  return useQuery({
    ...getNumberOfPeopleStartedCourseOptions({
      query: { granularity },
    }),
  })
}

export const useCourseModuleStatsByCompletionsRegisteredToStudyRegistryQuery = (
  granularity: TimeGranularity,
) => {
  return useQuery({
    ...getCourseModuleStatsByCompletionsRegisteredToStudyRegistryOptions({
      query: { granularity },
    }),
  })
}

export const useCompletionStatsByEmailDomainQuery = (year: number | undefined) => {
  return useQuery({
    ...getCompletionStatsByEmailDomainOptions(year === undefined ? undefined : { query: { year } }),
  })
}

export const useCourseCompletionStatsForEmailDomainQuery = (
  emailDomain: string,
  year: number | undefined,
) => {
  return useQuery({
    ...getCourseCompletionStatsForEmailDomainOptions({
      query: {
        email_domain: emailDomain,
        year,
      },
    }),
  })
}
