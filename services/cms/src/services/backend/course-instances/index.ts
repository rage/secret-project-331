import { EmailTemplate, EmailTemplateNew } from "../../services.types"
import { cmsClient } from "../cmsClient"

export const postNewEmailTemplateForCourseInstance = async (
  courseInstanceId: string,
  data: EmailTemplateNew,
): Promise<EmailTemplate> => {
  const response = await cmsClient.post(
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
  return (
    await cmsClient.get(`/course-instances/${courseInstanceId}/email-templates`, {
      responseType: "json",
    })
  ).data
}
