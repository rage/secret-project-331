import { cmsClient } from "./cmsClient"

import { validateResponse } from "@/shared-module/common/utils/fetching"

export const fetchCodeGiveawaysByCourseId = async (courseId: string) => {
  const response = await cmsClient.get(`/code-giveaways/by-course/${courseId}`)
  return validateResponse(response, Array.isArray)
}
