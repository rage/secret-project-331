import axios from "axios"
import { CourseOverview, Chapter, NewChapter } from "../../services.types"

export const fetchCourseStructure = async (courseId: string): Promise<CourseOverview> => {
  const url = `/api/v0/cms/courses/${courseId}/structure`
  const data = (await axios.get(url, { responseType: "json" })).data
  return data
}

export const postNewChapter = async (data: NewChapter): Promise<Chapter> => {
  const url = `/api/v0/cms/chapters`
  const response = await axios.post(url, data, {
    headers: { "Content-Type": "application/json" },
  })
  return response.data
}
