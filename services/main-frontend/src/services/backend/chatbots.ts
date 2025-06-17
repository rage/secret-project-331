import { mainFrontendClient } from "../mainFrontendClient"

import { NewChatbotConf } from "@/shared-module/common/bindings"
import { isChatbotConfiguration } from "@/shared-module/common/bindings.guard"
import { validateResponse } from "@/shared-module/common/utils/fetching"

export const getChatbotConfiguration = async (chatbotId: string) => {
  const response = await mainFrontendClient.get(`/chatbots/${chatbotId}`)
  return validateResponse(response, isChatbotConfiguration)
}

export const configureChatbot = async (chatbotId: string, data: NewChatbotConf) => {
  const response = await mainFrontendClient.post(`/chatbots/${chatbotId}`, data)
  return validateResponse(response, isChatbotConfiguration)
}

export const deleteChatbot = async (chatbotId: string) => {
  await mainFrontendClient.delete(`/chatbots/${chatbotId}`)
}
