import { cmsClient } from "./cmsClient"

import { ChatbotConfiguration } from "@/shared-module/common/bindings"
import { isChatbotConfiguration } from "@/shared-module/common/bindings.guard"
import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"

export const fetchChatbotConfigurationsForCourse = async (
  courseId: string,
): Promise<Array<ChatbotConfiguration>> => {
  const response = await cmsClient.get(`/courses/${courseId}/chatbot-configurations`, {
    headers: { "Content-Type": "application/json" },
  })
  return validateResponse(response, isArray(isChatbotConfiguration))
}
/// Should be in courses.ts ??
