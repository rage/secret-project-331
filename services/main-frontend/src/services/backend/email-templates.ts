import { mainFrontendClient } from "../mainFrontendClient"

import { EmailTemplate } from "@/shared-module/common/bindings"
import { isEmailTemplate } from "@/shared-module/common/bindings.guard"
import { validateResponse } from "@/shared-module/common/utils/fetching"

export const deleteEmailTemplate = async (id: string): Promise<EmailTemplate> => {
  const response = await mainFrontendClient.delete(`/email-templates/${id}`)
  return validateResponse(response, isEmailTemplate)
}
