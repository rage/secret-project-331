import { mainFrontendClient } from "../mainFrontendClient"

import { EmailTemplate } from "@/shared-module/common/bindings"
import { isEmailTemplate } from "@/shared-module/common/bindings.guard"
import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"

export const fetchAllEmailTemplates = async (): Promise<EmailTemplate[]> => {
  const response = await mainFrontendClient.get(`/email-templates`, {
    responseType: "json",
  })
  return validateResponse(response, isArray(isEmailTemplate))
}

export const deleteEmailTemplate = async (id: string): Promise<EmailTemplate> => {
  const response = await mainFrontendClient.delete(`/email-templates/${id}`)
  return validateResponse(response, isEmailTemplate)
}
