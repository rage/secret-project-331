import { CourseInstance, EmailTemplate, EmailTemplateNew } from "../../../shared-module/bindings"
import { cmsClient } from "../cmsClient"

export const fetchCourseInstance = async (courseInstanceId: string): Promise<CourseInstance> => {
  const res = await cmsClient.get(`/course-instances/${courseInstanceId}`, {
    headers: { "Content-Type": "application/json" },
  })
  return res.data
}

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
