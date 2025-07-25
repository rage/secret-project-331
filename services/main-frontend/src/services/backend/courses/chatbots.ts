import { mainFrontendClient } from "../../mainFrontendClient"

import { ChatbotConfiguration } from "@/shared-module/common/bindings"
import { isChatbotConfiguration } from "@/shared-module/common/bindings.guard"
import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"

export const getCourseChatbots = async (courseId: string): Promise<Array<ChatbotConfiguration>> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/chatbots`)
  return validateResponse(response, isArray(isChatbotConfiguration))
}

export const createChatbot = async (
  courseId: string,
  chatbotName: string,
): Promise<ChatbotConfiguration> => {
  const response = await mainFrontendClient.post(`/courses/${courseId}/chatbots`, chatbotName)
  return validateResponse(response, isChatbotConfiguration)
}

export const setAsDefaultChatbot = async (
  courseId: string,
  chatbotConfigurationId: string,
): Promise<ChatbotConfiguration> => {
  const response = await mainFrontendClient.post(
    `/courses/${courseId}/chatbots/${chatbotConfigurationId}/set-as-default`,
  )
  return validateResponse(response, isChatbotConfiguration)
}
