import { cmsClient } from "./cmsClient"
import { parseCmsResponse } from "./parseCmsResponse"

import { type EmailTemplate, type EmailTemplateUpdate } from "@/generated/api"
import { zEmailTemplate } from "@/generated/api/zod.generated"

export const fetchEmailTemplateWithId = async (emailTemplateId: string): Promise<EmailTemplate> => {
  const response = await cmsClient.get(`/email-templates/${emailTemplateId}`, {
    responseType: "json",
  })
  return parseCmsResponse(response, zEmailTemplate)
}

export const updateExistingEmailTemplate = async (
  id: string,
  { content, template_type, subject }: EmailTemplateUpdate,
): Promise<EmailTemplate> => {
  const response = await cmsClient.put(
    `/email-templates/${id}`,
    { content, template_type, subject },
    {
      headers: { "Content-Type": "application/json" },
    },
  )
  return parseCmsResponse(response, zEmailTemplate)
}

export const deleteEmailTemplate = async (id: string): Promise<EmailTemplate> => {
  const response = await cmsClient.delete(`/email-templates/${id}`)
  return parseCmsResponse(response, zEmailTemplate)
}
