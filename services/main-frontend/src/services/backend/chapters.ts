import { Chapter, ChapterUpdate, NewChapter } from "../../shared-module/bindings"
import { validateFile } from "../../shared-module/utils/files"
import { mainFrontendClient } from "../mainFrontendClient"

export const postNewChapter = async (data: NewChapter): Promise<Chapter> => {
  const response = await mainFrontendClient.post("/chapters", data, {
    headers: { "Content-Type": "application/json" },
  })
  return response.data
}

export const updateChapter = async (chapterId: string, data: ChapterUpdate): Promise<Chapter> => {
  const response = await mainFrontendClient.put(`/chapters/${chapterId}`, data, {
    headers: { "Content-Type": "application/json" },
  })
  return response.data
}

export const setChapterImage = async (chapterId: string, file: File): Promise<Chapter> => {
  // eslint-disable-next-line i18next/no-literal-string
  validateFile(file, ["image"])
  const data = new FormData()
  // eslint-disable-next-line i18next/no-literal-string
  data.append("file", file, file.name || "unknown")
  const res = await mainFrontendClient.put(`/chapters/${chapterId}/image`, data)
  return res.data
}

export const removeChapterImage = async (chapterId: string): Promise<void> => {
  const res = await mainFrontendClient.delete(`chapters/${chapterId}/image`)
  return res.data
}
