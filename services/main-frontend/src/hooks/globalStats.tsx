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
} from "../services/backend/global-stats"

import { TimeGranularity } from "@/shared-module/common/bindings"

export const useNumberOfPeopleCompletedACourseQuery = (granularity: TimeGranularity) => {
  return useQuery(getNumberOfPeopleCompletedACourseOptions(granularity))
}

export const useNumberOfPeopleRegisteredCompletionToStudyRegistryQuery = (
  granularity: TimeGranularity,
) => {
  return useQuery(getNumberOfPeopleRegisteredCompletionToStudyRegistryOptions(granularity))
}

export const useNumberOfPeopleDoneAtLeastOneExerciseQuery = (granularity: TimeGranularity) => {
  return useQuery(getNumberOfPeopleDoneAtLeastOneExerciseOptions(granularity))
}

export const useNumberOfPeopleStartedCourseQuery = (granularity: TimeGranularity) => {
  return useQuery(getNumberOfPeopleStartedCourseOptions(granularity))
}

export const useCourseModuleStatsByCompletionsRegisteredToStudyRegistryQuery = (
  granularity: TimeGranularity,
) => {
  return useQuery(getCourseModuleStatsByCompletionsRegisteredToStudyRegistryOptions(granularity))
}

export const useCompletionStatsByEmailDomainQuery = (year: number | undefined) => {
  return useQuery(getCompletionStatsByEmailDomainOptions(year))
}

export const useCourseCompletionStatsForEmailDomainQuery = (
  emailDomain: string,
  year: number | undefined,
) => {
  return useQuery(getCourseCompletionStatsForEmailDomainOptions(emailDomain, year))
}
