import { Chapter, NewChapter } from "../../../shared-module/bindings"
import { cmsClient } from "../cmsClient"

export const postNewChapter = async (data: NewChapter): Promise<Chapter> => {
  const response = await cmsClient.post("/chapters", data, {
    headers: { "Content-Type": "application/json" },
  })
  return response.data
}
