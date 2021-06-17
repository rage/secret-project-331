import axios from "axios"
import { DateTimeToISOString, ISOStringToDateTime } from "../../../utils/dateUtil"
import { CourseOverview, Chapter, NewChapter } from "../../services.types"

const cmsClient = axios.create({ baseURL: "/api/v0/cms" })

cmsClient.interceptors.response.use(
  (response) => {
    ISOStringToDateTime(response.data)
    return response
  },
  (err) => console.error(err),
)

cmsClient.interceptors.request.use(
  (data) => {
    DateTimeToISOString(data)
    return data
  },
  (err) => console.error(err),
)

export const fetchCourseStructure = async (courseId: string): Promise<CourseOverview> => {
  const data = (await cmsClient.get(`/courses/${courseId}/structure`, { responseType: "json" }))
    .data
  return data
}

export const postNewChapter = async (data: NewChapter): Promise<Chapter> => {
  const response = await axios.post("/chapters", data, {
    headers: { "Content-Type": "application/json" },
  })
  return response.data
}
