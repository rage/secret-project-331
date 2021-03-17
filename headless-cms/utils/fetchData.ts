import axios from 'axios'
import { API_URL } from '../constants'
import { PageData } from './types'

const fetchOrganizations = async () => {
  const url = `${API_URL}/api/v0/organizations`
  try {
    const data = (await axios.get(url, { responseType: 'json' })).data
    console.log(data)
    return data
  } catch (error) {
    console.log(error)
  }
}

const fetchCourses = async () => {
  const url = `${API_URL}/api/v0/courses`
  try {
    const data = (await axios.get(url, { responseType: 'json' })).data
    console.log(data)
    return data
  } catch (error) {
    console.log(error)
  }
}

const fetchCoursePages = async (courseId: string) => {
  const url = `${API_URL}/api/v0/courses/${courseId}/pages`
  try {
    const data = (await axios.get(url, { responseType: 'json' })).data
    console.log(data)
    return data
  } catch (error) {
    console.log(error)
  }
}

const fetchPageWithId = async (pageId: string | undefined): Promise<PageData | undefined> => {
  if (!pageId) {
    return undefined
  }
  const url = `${API_URL}/api/v0/pages/${pageId}`
  try {
    const data = (await axios.get(url, { responseType: 'json' })).data
    console.log(data)
    return data
  } catch (error) {
    console.log(error)
  }
}

const postNewPage = async (content: any) => {
  const url = `${API_URL}/api/v0/pages`
  try {
    const request = await axios.post(url, content, {
      headers: { 'Content-Type': 'application/json' },
    })
    console.log(request.data)
  } catch (error) {
    console.log(error)
  }
}

export { fetchOrganizations, fetchCourses, fetchCoursePages, fetchPageWithId, postNewPage }
