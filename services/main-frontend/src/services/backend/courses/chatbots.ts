import { mainFrontendClient } from "../../mainFrontendClient"

import { ChatbotConfiguration, NewChatbotConf } from "@/shared-module/common/bindings"
import { isChatbotConfiguration } from "@/shared-module/common/bindings.guard"
import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"

export const getCourseChatbots = async (courseId: string): Promise<Array<ChatbotConfiguration>> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/chatbots`)
  return validateResponse(response, isArray(isChatbotConfiguration))
}

export const createChatbot = async (
  courseId: string,
  data: NewChatbotConf,
): Promise<ChatbotConfiguration> => {
  const response = await mainFrontendClient.post(`/courses/${courseId}/chatbots`, data)
  return validateResponse(response, isChatbotConfiguration)
}

export const getChatbotConfiguration = async (chatbotId: string) => {
  const response = await mainFrontendClient.get(`/chatbots/${chatbotId}`)
  return validateResponse(response, isChatbotConfiguration)
}
