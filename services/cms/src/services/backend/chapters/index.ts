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

export const postChapterImageURLPath = async (chapterId: string, path: string): Promise<string> => {
  return (
    await cmsClient.post(`/chapters/${chapterId}/new-chapter-image`, {
      data: { path },
      headers: { "Content-Type": "application/json" },
    })
  ).data
}
