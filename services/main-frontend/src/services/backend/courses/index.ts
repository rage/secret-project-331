import axios from "axios"
import {
  Course,
  CourseSubmissionCount,
  CourseSubmissionCountByWeekdayAndHour,
  CourseUpdate,
  NewCourse,
} from "../../services.types"

export const getCourse = async (courseId: string): Promise<Course> => {
  const url = `/api/v0/main-frontend/courses/${courseId}`
  const data = (await axios.get(url, { responseType: "json" })).data
  return data
}

export const postNewCourse = async (data: NewCourse): Promise<Course> => {
  const url = `/api/v0/main-frontend/courses`
  const response = await axios.post(url, data, {
    headers: { "Content-Type": "application/json" },
  })
  return response.data
}

export const deleteCourse = async (courseId: string): Promise<Course> => {
  const url = `/api/v0/main-frontend/courses/${courseId}`
  const response = await axios.delete(url)
  return response.data
}

export const updateCourse = async (courseId: string, data: CourseUpdate): Promise<Course> => {
  const url = `/api/v0/main-frontend/courses/${courseId}`
  const response = await axios.put(url, data, {
    headers: { "Content-Type": "application/json" },
  })
  return response.data
}

export const fetchCourseDailySubmissionCounts = async (
  courseId: string,
): Promise<CourseSubmissionCount[]> => {
  const url = `/api/v0/main-frontend/courses/${courseId}/daily-submission-counts`
  const data = (await axios.get(url, { responseType: "json" })).data
  return data
}

export const fetchCourseWeekdayHourSubmissionCounts = async (
  courseId: string,
): Promise<CourseSubmissionCountByWeekdayAndHour[]> => {
  const url = `/api/v0/main-frontend/courses/${courseId}/weekday-hour-submission-counts`
  const data = (await axios.get(url, { responseType: "json" })).data
  return data
}
