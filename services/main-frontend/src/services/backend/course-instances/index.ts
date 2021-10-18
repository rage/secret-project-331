import { EmailTemplate, EmailTemplateNew, Points } from "../../../shared-module/bindings"
import { mainFrontendClient } from "../../mainFrontendClient"

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

export const getPoints = async (courseInstanceId: string): Promise<Points> => {
  const response = await mainFrontendClient.get(`/course-instances/${courseInstanceId}/points`, {
    responseType: "json",
  })
  return response.data
}
