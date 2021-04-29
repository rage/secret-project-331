import axios from "axios"
import { Course, CourseOverview, CoursePart, NewCoursePart } from "../../services.types"

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

const fetchCourseStructure = async (courseId: string): Promise<CourseOverview> => {
  const url = `/api/v0/cms/courses/${courseId}/structure`
  try {
    const data = (await axios.get(url, { responseType: "json" })).data
    console.log(data)
    return data
  } catch (error) {
    console.log(error)
  }
}

const postNewCoursePart = async (data: NewCoursePart): Promise<CoursePart> => {
  const url = `/api/v0/cms/course-parts`
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

export { fetchCourses, fetchCourseStructure, postNewCoursePart }
