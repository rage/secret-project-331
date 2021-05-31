import axios from "axios"
import { NewPage, Page, PageUpdate } from "../../services.types"

const fetchPageWithId = async (pageId: string): Promise<Page> => {
  const url = `/api/v0/cms/pages/${pageId}`
  try {
    const data = (await axios.get(url, { responseType: "json" })).data
    console.log(data)
    return data
  } catch (error) {
    console.log(error)
  }
}

const postNewPage = async (data: NewPage): Promise<Page> => {
  const url = `/api/v0/cms/pages`
  try {
    const response = await axios.post(url, data, {
      headers: { "Content-Type": "application/json" },
    })
    console.log(response.data)
    return response.data
  } catch (error) {
    console.log(error)
  }
}

const updateExistingPage = async ({
  page_id,
  content,
  url_path,
  title,
  course_part_id,
}: PageUpdate): Promise<Page> => {
  const url = `/api/v0/cms/pages/${page_id}`
  try {
    const response = await axios.put(
      url,
      // { content, exercises, url_path, title },
      { content, url_path, title, course_part_id },
      {
        headers: { "Content-Type": "application/json" },
      },
    )
    console.log(response.data)
    return response.data
  } catch (error) {
    console.log(error)
  }
}

const deletePage = async (page_id: string): Promise<Page> => {
  const url = `/api/v0/cms/pages/${page_id}`
  try {
    const response = await axios.delete(url)
    console.log(response.data)
    return response.data
  } catch (error) {
    console.log(error)
  }
}

export { updateExistingPage, postNewPage, fetchPageWithId, deletePage }
