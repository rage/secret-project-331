import {
  CmsPeerReviewConfiguration,
  NewResearchForm,
  ResearchForm,
} from "../../shared-module/bindings"
import { isCmsPeerReviewConfiguration, isResearchForm } from "../../shared-module/bindings.guard"
import { validateResponse } from "../../shared-module/utils/fetching"

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

export const fetchResearchFormWithCourseId = async (courseId: string): Promise<ResearchForm> => {
  const response = await cmsClient.get(`/courses/${courseId}/research-consent-form`, {
    responseType: "json",
  })
  return validateResponse(response, isResearchForm)
}

export const upsertResearchForm = async (
  courseId: string,
  data: NewResearchForm,
): Promise<ResearchForm> => {
  const response = await cmsClient.put(`/courses/${courseId}/research-consent-form`, data, {
    responseType: "json",
  })
  return validateResponse(response, isResearchForm)
}
