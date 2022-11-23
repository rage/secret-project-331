import { isBoolean } from "lodash"

import {
  CourseInstance,
  CourseInstanceCompletionSummary,
  CourseInstanceForm,
  EmailTemplate,
  EmailTemplateNew,
  ManualCompletionPreview,
  Points,
  TeacherManualCompletionRequest,
} from "../../shared-module/bindings"
import {
  isCourseInstance,
  isCourseInstanceCompletionSummary,
  isEmailTemplate,
  isManualCompletionPreview,
  isPoints,
} from "../../shared-module/bindings.guard"
import { isArray, validateResponse } from "../../shared-module/utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

export const fetchCourseInstance = async (courseInstanceId: string): Promise<CourseInstance> => {
  const response = await mainFrontendClient.get(`/course-instances/${courseInstanceId}`, {
    responseType: "json",
  })
  return validateResponse(response, isCourseInstance)
}

export const postNewEmailTemplateForCourseInstance = async (
  courseInstanceId: string,
  data: EmailTemplateNew,
): Promise<EmailTemplate> => {
  const response = await mainFrontendClient.post(
    `/course-instances/${courseInstanceId}/email-templates`,
    data,
    {
      headers: { "Content-Type": "application/json" },
    },
  )
  return validateResponse(response, isEmailTemplate)
}

export const postReprocessModuleCompletions = async (
  courseInstanceId: string,
): Promise<boolean> => {
  const res = await mainFrontendClient.post(
    `/course-instances/${courseInstanceId}/reprocess-completions`,
  )
  return validateResponse(res, isBoolean)
}

export const fetchCourseInstanceEmailTemplates = async (
  courseInstanceId: string,
): Promise<EmailTemplate[]> => {
  const response = await mainFrontendClient.get(
    `/course-instances/${courseInstanceId}/email-templates`,
    {
      responseType: "json",
    },
  )
  return validateResponse(response, isArray(isEmailTemplate))
}

export const getCompletions = async (
  courseInstanceId: string,
): Promise<CourseInstanceCompletionSummary> => {
  const response = await mainFrontendClient.get(
    `/course-instances/${courseInstanceId}/completions`,
    {
      responseType: "json",
    },
  )
  return validateResponse(response, isCourseInstanceCompletionSummary)
}

export const postCompletionsPreview = async (
  courseInstanceId: string,
  data: TeacherManualCompletionRequest,
): Promise<ManualCompletionPreview> => {
  const response = await mainFrontendClient.post(
    `/course-instances/${courseInstanceId}/completions/preview`,
    data,
    { responseType: "json" },
  )
  return validateResponse(response, isManualCompletionPreview)
}

export const postCompletions = async (
  courseInstanceId: string,
  data: TeacherManualCompletionRequest,
): Promise<void> => {
  const _response = await mainFrontendClient.post(
    `/course-instances/${courseInstanceId}/completions`,
    data,
  )
}

export const getPoints = async (courseInstanceId: string): Promise<Points> => {
  const response = await mainFrontendClient.get(`/course-instances/${courseInstanceId}/points`, {
    responseType: "json",
  })
  return validateResponse(response, isPoints)
}

export const getExerciseStatus = async (courseInstanceId: string): Promise<Points> => {
  const response = await mainFrontendClient.get(
    `/course-instances/${courseInstanceId}/exercise-status`,
    {
      responseType: "json",
    },
  )
  return validateResponse(response, isPoints)
}

export const editCourseInstance = async (
  courseInstanceId: string,
  update: CourseInstanceForm,
): Promise<void> => {
  await mainFrontendClient.post(`/course-instances/${courseInstanceId}/edit`, update, {
    responseType: "json",
  })
}

export const deleteCourseInstance = async (courseInstanceId: string): Promise<void> => {
  await mainFrontendClient.post(`/course-instances/${courseInstanceId}/delete`)
}
