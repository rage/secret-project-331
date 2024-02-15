import {
  CmsPeerReviewConfiguration,
  CourseModule,
  NewResearchForm,
  NewResearchFormQuestion,
  Page,
  ResearchForm,
  ResearchFormQuestion,
} from "../../shared-module/common/bindings"
import {
  isCmsPeerReviewConfiguration,
  isCourseModule,
  isPage,
  isResearchForm,
  isResearchFormQuestion,
} from "../../shared-module/common/bindings.guard"
import {
  isArray,
  isNull,
  isUnion,
  validateResponse,
} from "../../shared-module/common/utils/fetching"

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
