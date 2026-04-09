import { cmsClient } from "./cmsClient"
import { parseCmsResponse } from "./parseCmsResponse"

import {
  type ChatbotConfiguration,
  type CmsPeerOrSelfReviewConfiguration,
  type Course,
  type CourseModule,
  type NewResearchForm,
  type NewResearchFormQuestion,
  type Page,
  type ResearchForm,
  type ResearchFormQuestion,
} from "@/generated/api"
import { z } from "@/generated/api/zod"
import {
  zChatbotConfiguration,
  zCmsPeerOrSelfReviewConfiguration,
  zCourse,
  zCourseModule,
  zPage,
  zResearchForm,
  zResearchFormQuestion,
} from "@/generated/api/zod.generated"

export const getCoursesDefaultCmsPeerOrSelfReviewConfiguration = async (
  courseId: string,
): Promise<CmsPeerOrSelfReviewConfiguration> => {
  const response = await cmsClient.get(`/courses/${courseId}/default-peer-review`)
  return parseCmsResponse(response, zCmsPeerOrSelfReviewConfiguration)
}

export const putCoursesDefaultCmsPeerOrSelfReviewConfiguration = async (
  courseId: string,
  data: CmsPeerOrSelfReviewConfiguration,
): Promise<CmsPeerOrSelfReviewConfiguration> => {
  const response = await cmsClient.put(`/courses/${courseId}/default-peer-review`, data)
  return parseCmsResponse(response, zCmsPeerOrSelfReviewConfiguration)
}

export const getAllPagesForACourse = async (courseId: string): Promise<Page[]> => {
  const response = await cmsClient.get(`/courses/${courseId}/pages`)
  return parseCmsResponse(response, z.array(zPage))
}

export const fetchResearchFormWithCourseId = async (
  courseId: string,
): Promise<ResearchForm | null> => {
  const response = await cmsClient.get(`/courses/${courseId}/research-consent-form`, {
    responseType: "json",
  })
  return parseCmsResponse(response, z.nullable(zResearchForm))
}

export const upsertResearchForm = async (
  courseId: string,
  data: NewResearchForm,
): Promise<ResearchForm> => {
  const response = await cmsClient.put(`/courses/${courseId}/research-consent-form`, data, {
    responseType: "json",
  })
  return parseCmsResponse(response, zResearchForm)
}

export const upsertResearchFormQuestions = async (
  courseId: string,
  data: NewResearchFormQuestion[],
): Promise<ResearchFormQuestion> => {
  const response = await cmsClient.put(
    `/courses/${courseId}/research-consent-form-questions`,
    data,
    {
      responseType: "json",
    },
  )
  return parseCmsResponse(response, zResearchFormQuestion)
}

export const fetchCourseModulesByCourseId = async (
  courseId: string,
): Promise<Array<CourseModule>> => {
  const response = await cmsClient.get(`/courses/${courseId}/modules`, {
    responseType: "json",
  })
  return parseCmsResponse(response, z.array(zCourseModule))
}

export const fetchCourseById = async (courseId: string): Promise<Course> => {
  const response = await cmsClient.get(`/courses/${courseId}`, {
    responseType: "json",
  })
  return parseCmsResponse(response, zCourse)
}

export const fetchNondefaultChatbotConfigurationsForCourse = async (
  courseId: string,
): Promise<Array<ChatbotConfiguration>> => {
  const response = await cmsClient.get(`/courses/${courseId}/nondefault-chatbot-configurations`, {
    responseType: "json",
  })
  return parseCmsResponse(response, z.array(zChatbotConfiguration))
}
