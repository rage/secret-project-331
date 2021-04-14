import axios from "axios"
import { API_URL } from "../constants"
import { Course, Organization, Page, PageWithExercises } from "./services.types"

const fetchOrganizations = async (): Promise<Array<Organization>> => {
  const url = `${API_URL}/api/v0/organizations`
  try {
    const data = (await axios.get(url, { responseType: "json" })).data
    console.log(data)
    return data
  } catch (error) {
    console.log(error)
  }
}

const fetchCourses = async (): Promise<Array<Course>> => {
  const url = `${API_URL}/api/v0/courses`
  try {
    const data = (await axios.get(url, { responseType: "json" })).data
    console.log(data)
    return data
  } catch (error) {
    console.log(error)
  }
}

const fetchCoursePages = async (courseId: string): Promise<Array<Page>> => {
  const url = `${API_URL}/api/v0/courses/${courseId}/pages`
  try {
    const data = (await axios.get(url, { responseType: "json" })).data
    console.log(data)
    return data
  } catch (error) {
    console.log(error)
  }
}

const fetchPageWithId = async (pageId: string): Promise<PageWithExercises> => {
  const url = `${API_URL}/api/v0/pages/${pageId}`
  try {
    const data = (await axios.get(url, { responseType: "json" })).data
    console.log(data)
    return data
  } catch (error) {
    console.log(error)
  }
}

export { fetchOrganizations, fetchCourses, fetchCoursePages, fetchPageWithId }
