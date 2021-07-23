import { Page, PageUpdate } from "../../../shared-module/bindings"
import { cmsClient } from "../cmsClient"

export const fetchPageWithId = async (pageId: string): Promise<Page> => {
  const data = (await cmsClient.get(`/pages/${pageId}`, { responseType: "json" })).data
  return data
}

export const updateExistingPage = async (
  page_id: string,
  { content, url_path, title, chapter_id }: PageUpdate,
): Promise<Page> => {
  const response = await cmsClient.put(
    `/pages/${page_id}`,
    { content, url_path, title, chapter_id },
    {
      headers: { "Content-Type": "application/json" },
    },
  )
  return response.data
}
