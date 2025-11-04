import { mainFrontendClient } from "../mainFrontendClient"

import { ChatbotConfigurationModel, CourseInfo } from "@/shared-module/common/bindings"
import { isChatbotConfigurationModel } from "@/shared-module/common/bindings.guard"
import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"

export const getChatbotModels = async (
  courseId: string,
): Promise<Array<ChatbotConfigurationModel>> => {
  const params: CourseInfo = { course_id: courseId }
  const response = await mainFrontendClient.get(`/chatbot-models/`, { params })
  return validateResponse(response, isArray(isChatbotConfigurationModel))
}
