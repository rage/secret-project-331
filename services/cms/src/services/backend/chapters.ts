import { cmsClient } from "./cmsClient"

import { DatabaseChapter } from "@/shared-module/common/bindings"
import { isDatabaseChapter } from "@/shared-module/common/bindings.guard"
import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"

export const fetchAllChaptersByCourseId = async (courseId: string): Promise<DatabaseChapter[]> => {
  const response = await cmsClient.get(`/chapters/${courseId}/all-chapters-for-course`)
  return validateResponse(response, isArray(isDatabaseChapter))
}
