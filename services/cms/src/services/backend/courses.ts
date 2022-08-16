import { CmsPeerReviewConfiguration } from "../../shared-module/bindings"

import { cmsClient } from "./cmsClient"

export const getCoursesDefaultCmsPeerReviewConfiguration = async (
  courseId: string,
): Promise<CmsPeerReviewConfiguration> => {
  return (await cmsClient.get(`/courses/${courseId}/default-peer-review`)).data
}

export const putCoursesDefaultCmsPeerReviewConfiguration = async (
  courseId: string,
  data: CmsPeerReviewConfiguration,
): Promise<CmsPeerReviewConfiguration> => {
  return (await cmsClient.put(`/courses/${courseId}/default-peer-review`, data)).data
}
