import { EmailTemplate, NewEmailTemplate } from "../../services.types"
import { cmsClient } from "../cmsClient"

export const postNewEmailTemplateForCourseInstance = async (
  courseInstanceId: string,
  data: NewEmailTemplate,
): Promise<EmailTemplate> => {
  const response = await cmsClient.post(
    `/course-instances/${courseInstanceId}/email-templates`,
    data,
    {
      headers: { "Content-Type": "application/json" },
    },
  )
  console.log(response)
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
