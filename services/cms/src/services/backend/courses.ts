import { CmsPeerReviewConfiguration } from "../../shared-module/bindings"

import { cmsClient } from "./cmsClient"

export const getCoursesDefaultCmsPeerReviewConfiguration = async (
  courseId: string,
): Promise<CmsPeerReviewConfiguration> => {
  return (await cmsClient.get(`/courses/${courseId}/default-peer-review`)).data
}
