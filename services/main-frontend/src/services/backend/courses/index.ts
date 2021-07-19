import {
  Course,
  CourseInstance,
  CourseUpdate,
  Exercise,
  NewCourse,
  SubmissionCountByExercise,
  SubmissionCountByWeekAndHour,
} from "../../../shared-module/bindings"
import { mainFrontendClient } from "../../mainFrontendClient"

export const getCourse = async (courseId: string): Promise<Course> => {
  const data = (await mainFrontendClient.get(`/courses/${courseId}`, { responseType: "json" })).data
  return data
}

export const postNewCourse = async (data: NewCourse): Promise<Course> => {
  const response = await mainFrontendClient.post("/courses", data, {
    headers: { "Content-Type": "application/json" },
  })
  return response.data
}

export const deleteCourse = async (courseId: string): Promise<Course> => {
  const response = await mainFrontendClient.delete(`/courses/${courseId}`)
  return response.data
}

export const updateCourse = async (courseId: string, data: CourseUpdate): Promise<Course> => {
  const response = await mainFrontendClient.put(`/courses/${courseId}`, data, {
    headers: { "Content-Type": "application/json" },
  })
  return response.data
}

export const fetchCourseDailySubmissionCounts = async (
  courseId: string,
): Promise<SubmissionCountByExercise[]> => {
  const data = (
    await mainFrontendClient.get(`/courses/${courseId}/daily-submission-counts`, {
      responseType: "json",
    })
  ).data
  return data
}

export const fetchCourseExercises = async (courseId: string): Promise<Array<Exercise>> => {
  const data = (
    await mainFrontendClient.get(`/courses/${courseId}/exercises`, {
      responseType: "json",
    })
  ).data
  return data
}

export const fetchCourseWeekdayHourSubmissionCounts = async (
  courseId: string,
): Promise<SubmissionCountByWeekAndHour[]> => {
  const data = (
    await mainFrontendClient.get(`/courses/${courseId}/weekday-hour-submission-counts`, {
      responseType: "json",
    })
  ).data
  return data
}

export const fetchCourseInstances = async (courseId: string): Promise<CourseInstance[]> => {
  const data = (
    await mainFrontendClient.get(`/courses/${courseId}/course-instances`, { responseType: "json" })
  ).data
  return data
}
