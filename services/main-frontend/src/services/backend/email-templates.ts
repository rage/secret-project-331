import { EmailTemplate } from "../../shared-module/common/bindings"
import { isEmailTemplate } from "../../shared-module/common/bindings.guard"
import { validateResponse } from "../../shared-module/common/utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

export const deleteEmailTemplate = async (id: string): Promise<EmailTemplate> => {
  const response = await mainFrontendClient.delete(`/email-templates/${id}`)
  return validateResponse(response, isEmailTemplate)
}
