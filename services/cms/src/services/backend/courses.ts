import { CmsPeerReviewConfiguration } from "../../shared-module/bindings"
import { isCmsPeerReviewConfiguration } from "../../shared-module/bindings.guard"
import { validateResponse } from "../../shared-module/utils/fetching"

import { cmsClient } from "./cmsClient"

export const getCoursesDefaultCmsPeerReviewConfiguration = async (
  courseId: string,
): Promise<CmsPeerReviewConfiguration> => {
  return validateResponse(
    (await cmsClient.get(`/courses/${courseId}/default-peer-review`)).data,
    isCmsPeerReviewConfiguration,
  )
}

export const putCoursesDefaultCmsPeerReviewConfiguration = async (
  courseId: string,
  data: CmsPeerReviewConfiguration,
): Promise<CmsPeerReviewConfiguration> => {
  return validateResponse(
    (await cmsClient.put(`/courses/${courseId}/default-peer-review`, data)).data,
    isCmsPeerReviewConfiguration,
  )
}
