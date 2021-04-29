import axios from "axios"
import { Course, CourseOverview } from "../../services.types"

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

export { fetchCourses, fetchCourseStructure }
