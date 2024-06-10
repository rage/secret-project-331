import { mainFrontendClient } from "../mainFrontendClient"

import { Chapter, ChapterUpdate, NewChapter } from "@/shared-module/common/bindings"
import { isChapter } from "@/shared-module/common/bindings.guard"
import { validateResponse } from "@/shared-module/common/utils/fetching"
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
  // eslint-disable-next-line i18next/no-literal-string
  validateFile(file, ["image"])
  const data = new FormData()
  // eslint-disable-next-line i18next/no-literal-string
  data.append("file", file, file.name || "unknown")
  const response = await mainFrontendClient.put(`/chapters/${chapterId}/image`, data, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return validateResponse(response, isChapter)
}

export const removeChapterImage = async (chapterId: string): Promise<void> => {
  await mainFrontendClient.delete(`chapters/${chapterId}/image`)
}
