import axios from "axios"
import { DateTimeToISOString, ISOStringToDateTime } from "../../../utils/dateUtil"
import { NewPage, Page, PageUpdate } from "../../services.types"

const cmsPagesClient = axios.create({ baseURL: "/api/v0/cms/pages" })

cmsPagesClient.interceptors.response.use(
  (response) => {
    ISOStringToDateTime(response.data)
    return response
  },
  (err) => console.error(err),
)
cmsPagesClient.interceptors.request.use((data) => {
  DateTimeToISOString(data)
  return data
})

export const fetchPageWithId = async (pageId: string): Promise<Page> => {
  const data = (await cmsPagesClient.get(`/${pageId}`, { responseType: "json" })).data
  return data
}

export const postNewPage = async (data: NewPage): Promise<Page> => {
  const url = `/api/v0/cms/pages`

  const response = await cmsPagesClient.post("", data, {
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
  const url = `/api/v0/cms/pages/${page_id}`

  const response = await cmsPagesClient.put(
    `/${page_id}`,
    { content, url_path, title, chapter_id },
    {
      headers: { "Content-Type": "application/json" },
    },
  )
  return response.data
}

export const deletePage = async (page_id: string): Promise<Page> => {
  const url = `/api/v0/cms/pages/${page_id}`

  const response = await cmsPagesClient.delete(`/${page_id}`)
  return response.data
}
