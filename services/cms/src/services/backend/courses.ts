import { CmsPeerReviewConfiguration, Page } from "../../shared-module/bindings"
import { isCmsPeerReviewConfiguration, isPage } from "../../shared-module/bindings.guard"
import { isArray, validateResponse } from "../../shared-module/utils/fetching"

import { cmsClient } from "./cmsClient"

export const getCoursesDefaultCmsPeerReviewConfiguration = async (
  courseId: string,
): Promise<CmsPeerReviewConfiguration> => {
  const response = await cmsClient.get(`/courses/${courseId}/default-peer-review`)
  return validateResponse(response, isCmsPeerReviewConfiguration)
}

export const putCoursesDefaultCmsPeerReviewConfiguration = async (
  courseId: string,
  data: CmsPeerReviewConfiguration,
): Promise<CmsPeerReviewConfiguration> => {
  const response = await cmsClient.put(`/courses/${courseId}/default-peer-review`, data)
  return validateResponse(response, isCmsPeerReviewConfiguration)
}

export const getAllPagesForACourse = async (courseId: string): Promise<Page[]> => {
  const response = await cmsClient.get(`/courses/${courseId}/pages`)
  return validateResponse(response, isArray(isPage))
}
