import { cmsClient } from "./cmsClient"

import { EmailTemplate, EmailTemplateUpdate } from "@/shared-module/common/bindings"
import { isEmailTemplate } from "@/shared-module/common/bindings.guard"
import { validateResponse } from "@/shared-module/common/utils/fetching"

export const fetchEmailTemplateWithId = async (emailTemplateId: string): Promise<EmailTemplate> => {
  const response = await cmsClient.get(`/email-templates/${emailTemplateId}`, {
    responseType: "json",
  })
  return validateResponse(response, isEmailTemplate)
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
  return validateResponse(response, isEmailTemplate)
}

export const deleteEmailTemplate = async (id: string): Promise<EmailTemplate> => {
  const response = await cmsClient.delete(`/email-templates/${id}`)
  return validateResponse(response, isEmailTemplate)
}
