import { mainFrontendClient } from "../../mainFrontendClient"

import {
  CompletionGridRow,
  CourseUserInfo,
  ProgressOverview,
} from "@/shared-module/common/bindings"
import {
  isCompletionGridRow,
  isCourseUserInfo,
  isProgressOverview,
} from "@/shared-module/common/bindings.guard"
import { validateResponse } from "@/shared-module/common/utils/fetching"

const isCourseUserInfoArray = (x: unknown): x is CourseUserInfo[] =>
  Array.isArray(x) && x.every(isCourseUserInfo)

const isCompletionGridRowArray = (x: unknown): x is CompletionGridRow[] =>
  Array.isArray(x) && x.every(isCompletionGridRow)

export const getCourseUsers = async (courseId: string): Promise<CourseUserInfo[]> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/students/users`)
  return validateResponse(response, isCourseUserInfoArray)
}

export const getProgress = async (courseId: string): Promise<ProgressOverview> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/students/progress`)
  return validateResponse(response, isProgressOverview)
}

export const getCompletions = async (courseId: string): Promise<CompletionGridRow[]> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/students/completions`)
  return validateResponse(response, isCompletionGridRowArray)
}
