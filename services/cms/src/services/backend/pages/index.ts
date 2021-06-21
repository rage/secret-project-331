import { NewPage, Page, PageUpdate } from "../../services.types"
import { cmsClient } from "../cmsClient"

export const fetchPageWithId = async (pageId: string): Promise<Page> => {
  const data = (await cmsClient.get(`/pages/${pageId}`, { responseType: "json" })).data
  return data
}

export const postNewPage = async (data: NewPage): Promise<Page> => {
  const response = await cmsClient.post("/pages", data, {
    headers: { "Content-Type": "application/json" },
  })
  return response.data
}

export const updateExistingPage = async ({
  page_id,
  content,
  url_path,
  title,
  chapter_id,
}: PageUpdate): Promise<Page> => {
  const response = await cmsClient.put(
    `/pages/${page_id}`,
    { content, url_path, title, chapter_id },
    {
      headers: { "Content-Type": "application/json" },
    },
  )
  return response.data
}

export const deletePage = async (page_id: string): Promise<Page> => {
  const response = await cmsClient.delete(`/pages/${page_id}`)
  return response.data
}
