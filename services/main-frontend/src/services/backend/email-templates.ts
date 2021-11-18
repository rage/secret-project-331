import { EmailTemplate } from "../../shared-module/bindings"
import { mainFrontendClient } from "../mainFrontendClient"

export const deleteEmailTemplate = async (id: string): Promise<EmailTemplate> => {
  const response = await mainFrontendClient.delete(`/email-templates/${id}`)
  return response.data
}
