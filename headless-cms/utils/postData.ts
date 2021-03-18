import axios from 'axios'
import { API_URL } from '../constants'

const postNewPage = async (content: any) => {
  const url = `${API_URL}/api/v0/pages`
  try {
    const response = await axios.post(url, content, {
      headers: { 'Content-Type': 'application/json' },
    })
    console.log(response.data)
  } catch (error) {
    console.log(error)
  }
}

const updateExistingPage = async (
  pageId: string,
  newContent: Array<any>,
  exercises: Array<any>,
  url_path: string,
  title: string,
): Promise<Array<any>> => {
  const url = `${API_URL}/api/v0/pages/${pageId}`
  try {
    const response = await axios.put(
      url,
      { content: newContent, exercises, url_path, title },
      {
        headers: { 'Content-Type': 'application/json' },
      },
    )
    console.log(response.data)
    return response.data
  } catch (error) {
    console.log(error)
  }
}

export { postNewPage, updateExistingPage }
