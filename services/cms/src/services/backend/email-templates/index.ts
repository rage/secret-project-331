import { EmailTemplate, EmailTemplateUpdate } from "../../services.types"
import { cmsClient } from "../cmsClient"

export const fetchEmailTemplateWithId = async (emailTemplateId: string): Promise<EmailTemplate> => {
  return (await cmsClient.get(`/email-templates/${emailTemplateId}`, { responseType: "json" })).data
}

export const updateExistingEmailTemplate = async (
  id: string,
  { content, name, subject }: EmailTemplateUpdate,
): Promise<EmailTemplate> => {
  const response = await cmsClient.put(
    `/email-templates/${id}`,
    { content, name, subject },
    {
      headers: { "Content-Type": "application/json" },
    },
  )
  return response.data
}
