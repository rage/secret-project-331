import axios from "axios"
import {
  Course,
  CourseSubmissionCount,
  CourseSubmissionCountByWeekdayAndHour,
  NewCourse,
} from "../../services.types"

export const postNewCourse = async (data: NewCourse): Promise<Course> => {
  const url = `/api/v0/cms/courses`
  const response = await axios.post(url, data, {
    headers: { "Content-Type": "application/json" },
  })
  return response.data
}

export const fetchCourseDailySubmissionCounts = async (
  courseId: string,
): Promise<CourseSubmissionCount[]> => {
  const url = `/api/v0/cms/courses/${courseId}/daily-submission-counts`
  const data = (await axios.get(url, { responseType: "json" })).data
  return data
}

export const fetchCourseWeekdayHourSubmissionCounts = async (
  courseId: string,
): Promise<CourseSubmissionCountByWeekdayAndHour[]> => {
  const url = `/api/v0/cms/courses/${courseId}/weekday-hour-submission-counts`
  const data = (await axios.get(url, { responseType: "json" })).data
  return data
}
