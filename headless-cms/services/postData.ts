import axios from 'axios'
import { API_URL } from '../constants'
import { NewPage, PageUpdate, PageWithExercises } from './services.types'

const postNewPage = async (data: NewPage): Promise<PageWithExercises> => {
  const url = `${API_URL}/api/v0/pages`
  try {
    const response = await axios.post(url, data, {
      headers: { 'Content-Type': 'application/json' },
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
  exercises,
  url_path,
  title,
}: PageUpdate): Promise<PageWithExercises> => {
  const url = `${API_URL}/api/v0/pages/${page_id}`
  try {
    const response = await axios.put(
      url,
      { content, exercises, url_path, title },
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

const deletePage = async (page_id: string): Promise<PageWithExercises> => {
  const url = `${API_URL}/api/v0/pages/${page_id}`
  try {
    const response = await axios.delete(url)
    console.log(response.data)
    return response.data
  } catch (error) {
    console.log(error)
  }
}

export { postNewPage, updateExistingPage, deletePage }
