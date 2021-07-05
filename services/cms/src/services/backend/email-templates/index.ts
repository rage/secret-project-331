import { BlockInstance } from "@wordpress/blocks"
import { cmsClient } from "../cmsClient"

export const fetchEmailTemplateWithId = async (emailTemplateId: string): Promise<any> => {
  return (
    await cmsClient.get(`/course-instances/${emailTemplateId}/emails`, { responseType: "json" })
  ).data
}

export const updateExistingEmailTemplate = async (
  email_template_id: string,
  subject: string,
  content: BlockInstance[],
): Promise<any> => {
  return content
}
