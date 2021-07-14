import { validateFile } from "../../../shared-module/utils/files"
import { Chapter, ChapterUpdate, NewChapter } from "../../services.types"
import { cmsClient } from "../cmsClient"

export const postNewChapter = async (data: NewChapter): Promise<Chapter> => {
  const response = await cmsClient.post("/chapters", data, {
    headers: { "Content-Type": "application/json" },
  })
  return response.data
}

export const updateChapter = async (chapterId: string, data: ChapterUpdate): Promise<Chapter> => {
  const response = await cmsClient.put(`/chapters/${chapterId}`, data, {
    headers: { "Content-Type": "application/json" },
  })
  return response.data
}

export const postChapterImage = async (chapterId: string, file: File): Promise<Chapter> => {
  // TODO: How to use allowedFiles of validateFile?
  // validateFile(file, [])
  const data = new FormData()
  data.append("file", file, file.name || "unknown")
  const res = await cmsClient.post(`/chapters/${chapterId}/image`, data)
  return res.data
}

export const removeChapterImage = async (chapterId: string): Promise<void> => {
  const res = await cmsClient.delete(`chapters/${chapterId}/image`)
  return res.data
}
