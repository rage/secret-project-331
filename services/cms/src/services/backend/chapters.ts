import { cmsClient } from "./cmsClient"
import { parseCmsResponse } from "./parseCmsResponse"

import { type DatabaseChapter } from "@/generated/api"
import { z } from "@/generated/api/zod"
import { zDatabaseChapter } from "@/generated/api/zod.generated"

export const fetchAllChaptersByCourseId = async (courseId: string): Promise<DatabaseChapter[]> => {
  const response = await cmsClient.get(`/chapters/${courseId}/all-chapters-for-course`)
  return parseCmsResponse(response, z.array(zDatabaseChapter))
}
