import axios from "axios"
import { DateTimeToISOString, ISOStringToDateTime } from "../../../utils/dateUtil"
import {
  Course,
  CourseSubmissionCount,
  CourseSubmissionCountByWeekdayAndHour,
  CourseUpdate,
  NewCourse,
} from "../../services.types"

const mainFrontendCoursesClient = axios.create({ baseURL: "/api/v0/main-frontend/courses" })

mainFrontendCoursesClient.interceptors.response.use(
  (response) => {
    ISOStringToDateTime(response.data)
    return response
  },
  (err) => console.error(err),
)

mainFrontendCoursesClient.interceptors.request.use(
  (data) => {
    DateTimeToISOString(data)
    return data
  },
  (err) => console.error(err),
)

export const getCourse = async (courseId: string): Promise<Course> => {
  const url = `/api/v0/main-frontend/courses/${courseId}`
  const data = (await mainFrontendCoursesClient.get(`/${courseId}`, { responseType: "json" })).data
  return data
}

export const postNewCourse = async (data: NewCourse): Promise<Course> => {
  const url = `/api/v0/main-frontend/courses`
  const response = await mainFrontendCoursesClient.post("", data, {
    headers: { "Content-Type": "application/json" },
  })
  return response.data
}

export const deleteCourse = async (courseId: string): Promise<Course> => {
  const url = `/api/v0/main-frontend/courses/${courseId}`
  const response = await mainFrontendCoursesClient.delete(`/${courseId}`)
  return response.data
}

export const updateCourse = async (courseId: string, data: CourseUpdate): Promise<Course> => {
  const url = `/api/v0/main-frontend/courses/${courseId}`
  const response = await mainFrontendCoursesClient.put(`/${courseId}`, data, {
    headers: { "Content-Type": "application/json" },
  })
  return response.data
}

export const fetchCourseDailySubmissionCounts = async (
  courseId: string,
): Promise<CourseSubmissionCount[]> => {
  const url = `/api/v0/main-frontend/courses/${courseId}/daily-submission-counts`
  const data = (
    await mainFrontendCoursesClient.get(`/${courseId}/daily-submission-counts`, {
      responseType: "json",
    })
  ).data
  return data
}

export const fetchCourseWeekdayHourSubmissionCounts = async (
  courseId: string,
): Promise<CourseSubmissionCountByWeekdayAndHour[]> => {
  const url = `/api/v0/main-frontend/courses/${courseId}/weekday-hour-submission-counts`
  const data = (
    await mainFrontendCoursesClient.get(`/${courseId}/weekday-hour-submission-counts`, {
      responseType: "json",
    })
  ).data
  return data
}
