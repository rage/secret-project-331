import {
  CourseInstance,
  EmailTemplate,
  EmailTemplateNew,
  ScheduleUpdate,
  SupervisorUpdate,
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

export const editSupervisor = async (
  courseInstanceId: string,
  name: string | null,
  email: string | null,
): Promise<void> => {
  const data: SupervisorUpdate = { name, email }
  const response = await mainFrontendClient.post(
    `/course-instances/${courseInstanceId}/edit-supervisor`,
    data,
    { responseType: "json" },
  )
  return response.data
}

export const editSchedule = async (
  courseInstanceId: string,
  openingTime: Date | null,
  closingTime: Date | null,
): Promise<void> => {
  const data: ScheduleUpdate = { opening_time: openingTime, closing_time: closingTime }
  const response = await mainFrontendClient.post(
    `/course-instances/${courseInstanceId}/edit-schedule`,
    data,
    { responseType: "json" },
  )
  return response.data
}
