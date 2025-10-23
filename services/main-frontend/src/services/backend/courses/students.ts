import { mainFrontendClient } from "../../mainFrontendClient"

import { CourseUserInfo, ProgressOverview } from "@/shared-module/common/bindings"
import { isCourseUserInfo, isProgressOverview } from "@/shared-module/common/bindings.guard"
import { validateResponse } from "@/shared-module/common/utils/fetching"

const isCourseUserInfoArray = (x: unknown): x is CourseUserInfo[] =>
  Array.isArray(x) && x.every(isCourseUserInfo)

export const getCourseUsers = async (courseId: string): Promise<CourseUserInfo[]> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/students/users`)
  return validateResponse(response, isCourseUserInfoArray)
}

export const getProgress = async (courseId: string): Promise<ProgressOverview> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/students/progress`)
  return validateResponse(response, isProgressOverview)
}
