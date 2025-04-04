import { mainFrontendClient } from "../mainFrontendClient"

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
import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"

export const getNumberOfPeopleCompletedACourse = async (
  granularity: TimeGranularity,
): Promise<GlobalStatEntry[]> => {
  const params = new URLSearchParams()
  params.append("granularity", granularity)

  const response = await mainFrontendClient.get(
    `/global-stats/number-of-people-completed-a-course?${params}`,
  )
  return validateResponse(response, isArray(isGlobalStatEntry))
}

export const getNumberOfPeopleRegisteredCompletionToStudyRegistry = async (
  granularity: TimeGranularity,
): Promise<GlobalStatEntry[]> => {
  const params = new URLSearchParams()
  params.append("granularity", granularity)

  const response = await mainFrontendClient.get(
    `/global-stats/number-of-people-registered-completion-to-study-registry?${params}`,
  )
  return validateResponse(response, isArray(isGlobalStatEntry))
}

export const getNumberOfPeopleDoneAtLeastOneExercise = async (
  granularity: TimeGranularity,
): Promise<GlobalStatEntry[]> => {
  const params = new URLSearchParams()
  params.append("granularity", granularity)

  const response = await mainFrontendClient.get(
    `/global-stats/number-of-people-done-at-least-one-exercise?${params}`,
  )
  return validateResponse(response, isArray(isGlobalStatEntry))
}

export const getnumberOfPeopleStartedCourse = async (
  granularity: TimeGranularity,
): Promise<GlobalStatEntry[]> => {
  const params = new URLSearchParams()
  params.append("granularity", granularity)

  const response = await mainFrontendClient.get(
    `/global-stats/number-of-people-started-course?${params}`,
  )
  return validateResponse(response, isArray(isGlobalStatEntry))
}

export const getCourseModuleStatsByCompletionsRegisteredToStudyRegistry = async (
  granularity: TimeGranularity,
): Promise<GlobalCourseModuleStatEntry[]> => {
  const params = new URLSearchParams()
  params.append("granularity", granularity)

  const response = await mainFrontendClient.get(
    `/global-stats/course-module-stats-by-completions-registered-to-study-registry?${params}`,
  )
  return validateResponse(response, isArray(isGlobalCourseModuleStatEntry))
}

export const getCompletionStatsByEmailDomain = async (
  year?: number,
): Promise<DomainCompletionStats[]> => {
  const params = new URLSearchParams()
  if (year) {
    params.append("year", year.toString())
  }

  const response = await mainFrontendClient.get(
    `/global-stats/completion-stats-by-email-domain${params.toString() ? `?${params.toString()}` : ""}`,
  )
  return validateResponse(response, isArray(isDomainCompletionStats))
}

export const getCourseCompletionStatsForEmailDomain = async (
  emailDomain: string,
  year?: number,
): Promise<CourseCompletionStats[]> => {
  const params = new URLSearchParams()
  params.append("email_domain", emailDomain)
  if (year) {
    params.append("year", year.toString())
  }

  const response = await mainFrontendClient.get(
    `/global-stats/course-completion-stats-for-email-domain?${params.toString()}`,
  )
  return validateResponse(response, isArray(isCourseCompletionStats))
}
