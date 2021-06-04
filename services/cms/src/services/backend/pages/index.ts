import axios from "axios"
import { NewPage, Page, PageUpdate } from "../../services.types"

export const fetchPageWithId = async (pageId: string): Promise<Page> => {
  const url = `/api/v0/cms/pages/${pageId}`

  const data = (await axios.get(url, { responseType: "json" })).data
  return data
}

export const postNewPage = async (data: NewPage): Promise<Page> => {
  const url = `/api/v0/cms/pages`

  const response = await axios.post(url, data, {
    headers: { "Content-Type": "application/json" },
  })
  return response.data
}

export const updateExistingPage = async ({
  page_id,
  content,
  url_path,
  title,
  course_part_id,
}: PageUpdate): Promise<Page> => {
  const url = `/api/v0/cms/pages/${page_id}`

  const response = await axios.put(
    url,
    { content, url_path, title, course_part_id },
    {
      headers: { "Content-Type": "application/json" },
    },
  )
  return response.data
}

export const deletePage = async (page_id: string): Promise<Page> => {
  const url = `/api/v0/cms/pages/${page_id}`

  const response = await axios.delete(url)
  return response.data
}
