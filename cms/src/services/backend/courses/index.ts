import axios from "axios"
import {
  Course,
  CourseOverview,
  CoursePart,
  CourseSubmissionCount,
  CourseSubmissionCountByWeekdayAndHour,
  NewCourse,
  NewCoursePart,
} from "../../services.types"

const fetchCourses = async (): Promise<Array<Course>> => {
  const url = `/api/v0/cms/courses`
  try {
    const data = (await axios.get(url, { responseType: "json" })).data
    console.log(data)
    return data
  } catch (error) {
    console.log(error)
    throw error
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
    throw error
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
    throw error
  }
}

const postNewCourse = async (data: NewCourse): Promise<Course> => {
  const url = `/api/v0/cms/courses`
  try {
    const response = await axios.post(url, data, {
      headers: { "Content-Type": "application/json" },
    })
    console.log(response.data)
    return response.data
  } catch (error) {
    console.log(error)
    throw error
  }
}

const fetchCourseDailySubmissionCounts = async (
  courseId: string,
): Promise<CourseSubmissionCount[]> => {
  const url = `/api/v0/cms/courses/${courseId}/daily-submission-counts`
  try {
    const data = (await axios.get(url, { responseType: "json" })).data
    console.log(data)
    return data
  } catch (error) {
    console.log(error)
    throw error
  }
}

const fetchCourseWeekdayHourSubmissionCounts = async (
  courseId: string,
): Promise<CourseSubmissionCountByWeekdayAndHour[]> => {
  const url = `/api/v0/cms/courses/${courseId}/weekday-hour-submission-counts`
  try {
    const data = (await axios.get(url, { responseType: "json" })).data
    console.log(data)
    return data
  } catch (error) {
    console.log(error)
    throw error
  }
}

export {
  fetchCourses,
  fetchCourseStructure,
  postNewCoursePart,
  postNewCourse,
  fetchCourseDailySubmissionCounts,
  fetchCourseWeekdayHourSubmissionCounts,
}
