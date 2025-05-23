import { mainFrontendClient } from "../mainFrontendClient"

import {
  Chapter,
  ChapterUpdate,
  DatabaseChapter,
  NewChapter,
} from "@/shared-module/common/bindings"
import { isChapter, isDatabaseChapter } from "@/shared-module/common/bindings.guard"
import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"
import { validateFile } from "@/shared-module/common/utils/files"

export const postNewChapter = async (data: NewChapter): Promise<Chapter> => {
  const response = await mainFrontendClient.post("/chapters", data)
  return validateResponse(response, isChapter)
}

export const updateChapter = async (chapterId: string, data: ChapterUpdate): Promise<Chapter> => {
  const response = await mainFrontendClient.put(`/chapters/${chapterId}`, data)
  return validateResponse(response, isChapter)
}

export const deleteChapter = async (chapterId: string): Promise<Chapter> => {
  const response = await mainFrontendClient.delete(`/chapters/${chapterId}`)
  return validateResponse(response, isChapter)
}

export const setChapterImage = async (chapterId: string, file: File): Promise<Chapter> => {
  validateFile(file, ["image"])
  const data = new FormData()

  data.append("file", file, file.name || "unknown")
  const response = await mainFrontendClient.put(`/chapters/${chapterId}/image`, data, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return validateResponse(response, isChapter)
}

export const removeChapterImage = async (chapterId: string): Promise<void> => {
  await mainFrontendClient.delete(`chapters/${chapterId}/image`)
}

export const fetchAllChaptersByCourseId = async (courseId: string): Promise<DatabaseChapter[]> => {
  const response = await mainFrontendClient.get(`/chapters/${courseId}/all-chapters-for-course`)
  return validateResponse(response, isArray(isDatabaseChapter))
}
