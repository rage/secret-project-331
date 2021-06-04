import axios from "axios"
import { CourseOverview, CoursePart, NewCoursePart } from "../../services.types"

export const fetchCourseStructure = async (courseId: string): Promise<CourseOverview> => {
  const url = `/api/v0/cms/courses/${courseId}/structure`
  const data = (await axios.get(url, { responseType: "json" })).data
  return data
}

export const postNewCoursePart = async (data: NewCoursePart): Promise<CoursePart> => {
  const url = `/api/v0/cms/course-parts`
  const response = await axios.post(url, data, {
    headers: { "Content-Type": "application/json" },
  })
  return response.data
}
