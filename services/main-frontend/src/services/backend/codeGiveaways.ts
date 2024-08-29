import { mainFrontendClient } from "../mainFrontendClient"

import { CodeGiveaway, CodeGiveawayCode } from "@/shared-module/common/bindings"
import { isCodeGiveaway, isCodeGiveawayCode } from "@/shared-module/common/bindings.guard"
import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"

export const fetchCodeGiveawaysByCourse = async (courseId: string): Promise<CodeGiveaway[]> => {
  const response = await mainFrontendClient.get(`/code-giveaways/by-course/${courseId}`)
  return validateResponse(response, isArray(isCodeGiveaway))
}

export const createCodeGiveaway = async (courseId: string, name: string): Promise<CodeGiveaway> => {
  const response = await mainFrontendClient.post("/code-giveaways", { course_id: courseId, name })
  return validateResponse(response, isCodeGiveaway)
}

export const fetchCodeGiveawayById = async (id: string): Promise<CodeGiveaway> => {
  const response = await mainFrontendClient.get(`/code-giveaways/${id}`)
  return validateResponse(response, isCodeGiveaway)
}

export const fetchCodesByCodeGiveawayId = async (id: string): Promise<CodeGiveawayCode[]> => {
  const response = await mainFrontendClient.get(`/code-giveaways/${id}/codes`)
  return validateResponse(response, isArray(isCodeGiveawayCode))
}

export const addCodesToCodeGiveaway = async (
  id: string,
  codes: string[],
): Promise<CodeGiveawayCode[]> => {
  const response = await mainFrontendClient.post(`/code-giveaways/${id}/codes`, codes)
  return validateResponse(response, isArray(isCodeGiveawayCode))
}
