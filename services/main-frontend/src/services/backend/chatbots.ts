import { mainFrontendClient } from "../mainFrontendClient"

import { ChatbotConfiguration, NewChatbotConf } from "@/shared-module/common/bindings"
import { isChatbotConfiguration } from "@/shared-module/common/bindings.guard"
import { validateResponse } from "@/shared-module/common/utils/fetching"

export const getChatbotConfiguration = async (
  chatbotConfigurationId: string,
): Promise<ChatbotConfiguration> => {
  const response = await mainFrontendClient.get(`/chatbots/${chatbotConfigurationId}`)
  return validateResponse(response, isChatbotConfiguration)
}

export const configureChatbot = async (
  chatbotConfigurationId: string,
  data: NewChatbotConf,
): Promise<ChatbotConfiguration> => {
  const response = await mainFrontendClient.post(`/chatbots/${chatbotConfigurationId}`, data)
  return validateResponse(response, isChatbotConfiguration)
}

export const deleteChatbot = async (chatbotConfigurationId: string): Promise<void> => {
  await mainFrontendClient.delete(`/chatbots/${chatbotConfigurationId}`)
}
