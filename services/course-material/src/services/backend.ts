import axios from "axios"
import { DateTime } from "luxon"
import { DateTimeToISOString, ISOStringToDateTime } from "../utils/dateUtil"

const axiosClient = axios.create({
  baseURL: "/api/v0/course-material",
})

axiosClient.interceptors.response.use((response) => {
  ISOStringToDateTime(response.data)
  return response
})

axiosClient.interceptors.request.use((data) => {
  DateTimeToISOString(data)
  return data
})

export interface Course {
  id: string
  created_at: DateTime
  updated_at: DateTime
  name: string
  deleted_at: DateTime | null
  slug: string
}

export const fetchCourses = async (): Promise<Array<Course>> => {
  const data = (await axiosClient.get("/courses", { responseType: "json" })).data
  return data
}

export interface Organization {
  id: string
  created_at: DateTime
  updated_at: DateTime
  name: string
  deleted_at: DateTime | null
}

export const fetchOrganizations = async (): Promise<Array<Organization>> => {
  const data = (await axiosClient.get("/organizations", { responseType: "json" })).data
  return data
}

export const fetchOrganizationCourses = async (organizationId: string): Promise<Array<Course>> => {
  const data = (
    await axiosClient.get(`/organizations/${organizationId}/courses`, {
      responseType: "json",
    })
  ).data
  return data
}

export interface CoursePage {
  id: string
  created_at: DateTime
  updated_at: DateTime
  course_id: string
  content: Block<unknown>[]
  url_path: string
  title: string
  deleted_at: DateTime | null
  chapter_id: string
}

export interface Block<T> {
  name: string
  isValid: boolean
  clientId: string
  attributes: T
  innerBlocks: any[]
}

export const fetchCoursePageByPath = async (
  courseSlug: string,
  path: string,
): Promise<CoursePage> => {
  const data = (
    await axiosClient.get(`/courses/${courseSlug}/page-by-path/${path}`, {
      responseType: "json",
    })
  ).data
  return data
}

export const fetchAllCoursePages = async (courseId: string): Promise<CoursePage[]> => {
  const data = (
    await axiosClient.get(`/courses/${courseId}/pages`, {
      responseType: "json",
    })
  ).data
  return data
}

export interface CourseMaterialExercise {
  exercise: Exercise
  current_exercise_task: CurrentExerciseTask
  exercise_status?: ExerciseStatus
}

export interface CurrentExerciseTask {
  id: string
  exercise_id: string
  exercise_type: string
  assignment: unknown[]
  public_spec: unknown
}

export interface Exercise {
  id: string
  created_at: DateTime
  updated_at: DateTime
  name: string
  course_id: string
  page_id: string
  deadline: null
  deleted_at: DateTime | null
  score_maximum: number
}

export interface ExerciseStatus {
  score_given?: number
  activity_progress: string
  grading_progress: string
}

export const fetchExerciseById = async (id: string): Promise<CourseMaterialExercise> => {
  const data = (await axiosClient.get(`/exercises/${id}`, { responseType: "json" })).data
  return data
}

export interface ChapterPagesWithExercises {
  id: string
  created_at: DateTime
  updated_at: DateTime
  course_id: string
  chapter_id: string
  content: any
  url_path: string
  title: string
  deleted_at: DateTime
  exercises: Exercise[]
}

export const fetchChaptersExercises = async (
  chapterId: string,
): Promise<ChapterPagesWithExercises[]> => {
  const data = (
    await axiosClient.get(`/chapters/${chapterId}/exercises`, {
      responseType: "json",
    })
  ).data
  return data
}
