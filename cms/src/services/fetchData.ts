import axios from "axios"
import { Course, Organization, Page, PageWithExercises } from "./services.types"

const fetchOrganizations = async (): Promise<Array<Organization>> => {
  const url = `/api/v0/cms/organizations`
  try {
    const data = (await axios.get(url, { responseType: "json" })).data
    console.log(data)
    return data
  } catch (error) {
    console.log(error)
  }
}

const fetchCourses = async (): Promise<Array<Course>> => {
  const url = `/api/v0/cms/courses`
  try {
    const data = (await axios.get(url, { responseType: "json" })).data
    console.log(data)
    return data
  } catch (error) {
    console.log(error)
  }
}

const fetchCoursePages = async (courseId: string): Promise<Array<Page>> => {
  const url = `/api/v0/cms/courses/${courseId}/pages`
  try {
    const data = (await axios.get(url, { responseType: "json" })).data
    console.log(data)
    return data
  } catch (error) {
    console.log(error)
  }
}

const fetchPageWithId = async (pageId: string): Promise<PageWithExercises> => {
  const url = `/api/v0/cms/pages/${pageId}`
  try {
    const data = (await axios.get(url, { responseType: "json" })).data
    console.log(data)
    return data
  } catch (error) {
    console.log(error)
  }
}

export { fetchOrganizations, fetchCourses, fetchCoursePages, fetchPageWithId }
