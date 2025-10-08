import { mainFrontendClient } from "../mainFrontendClient"

import { ChatbotConfigurationModel } from "@/shared-module/common/bindings"
import { isChatbotConfigurationModel } from "@/shared-module/common/bindings.guard"
import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"

export const getChatbotModels = async (
  courseId: string,
): Promise<Array<ChatbotConfigurationModel>> => {
  const response = await mainFrontendClient.get(`/chatbot-models/`)
  return validateResponse(response, isArray(isChatbotConfigurationModel))
}
