import {
  CmsPeerOrSelfReviewConfiguration,
  CourseModule,
  NewResearchForm,
  NewResearchFormQuestion,
  Page,
  ResearchForm,
  ResearchFormQuestion,
} from "../../shared-module/bindings"
import {
  isCmsPeerOrSelfReviewConfiguration,
  isCourseModule,
  isPage,
  isResearchForm,
  isResearchFormQuestion,
} from "../../shared-module/bindings.guard"
import { isArray, isNull, isUnion, validateResponse } from "../../shared-module/utils/fetching"

import { cmsClient } from "./cmsClient"

export const getCoursesDefaultCmsPeerOrSelfReviewConfiguration = async (
  courseId: string,
): Promise<CmsPeerOrSelfReviewConfiguration> => {
  const response = await cmsClient.get(`/courses/${courseId}/default-peer-review`)
  return validateResponse(response, isCmsPeerOrSelfReviewConfiguration)
}

export const putCoursesDefaultCmsPeerOrSelfReviewConfiguration = async (
  courseId: string,
  data: CmsPeerOrSelfReviewConfiguration,
): Promise<CmsPeerOrSelfReviewConfiguration> => {
  const response = await cmsClient.put(`/courses/${courseId}/default-peer-review`, data)
  return validateResponse(response, isCmsPeerOrSelfReviewConfiguration)
}

export const getAllPagesForACourse = async (courseId: string): Promise<Page[]> => {
  const response = await cmsClient.get(`/courses/${courseId}/pages`)
  return validateResponse(response, isArray(isPage))
}

export const fetchResearchFormWithCourseId = async (
  courseId: string,
): Promise<ResearchForm | null> => {
  const response = await cmsClient.get(`/courses/${courseId}/research-consent-form`, {
    responseType: "json",
  })
  return validateResponse(response, isUnion(isResearchForm, isNull))
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

export const upsertResearchFormQuestion = async (
  courseId: string,
  data: NewResearchFormQuestion,
): Promise<ResearchFormQuestion> => {
  const response = await cmsClient.put(
    `/courses/${courseId}/research-consent-form-question`,
    data,
    {
      responseType: "json",
    },
  )
  return validateResponse(response, isResearchFormQuestion)
}

export const fetchCourseModulesByCourseId = async (
  courseId: string,
): Promise<Array<CourseModule>> => {
  const response = await cmsClient.get(`/courses/${courseId}/modules`, {
    responseType: "json",
  })
  return validateResponse(response, isArray(isCourseModule))
}
