import {
  CourseInstance,
  CourseInstanceForm,
  EmailTemplate,
  EmailTemplateNew,
} from "../../../shared-module/bindings"
import { mainFrontendClient } from "../../mainFrontendClient"

export const fetchCourseInstance = async (courseInstanceId: string): Promise<CourseInstance> => {
  const response = await mainFrontendClient.get(`/course-instances/${courseInstanceId}`, {
    responseType: "json",
  })
  return response.data
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
  return response.data
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
  return response.data
}

export const editCourseInstance = async (
  courseInstanceId: string,
  update: CourseInstanceForm,
): Promise<void> => {
  const response = await mainFrontendClient.post(
    `/course-instances/${courseInstanceId}/edit`,
    update,
    { responseType: "json" },
  )
  return response.data
}

export const deleteCourseInstance = async (courseInstanceId: string): Promise<void> => {
  const response = await mainFrontendClient.post(`/course-instances/${courseInstanceId}/delete`)
  return response.data
}
