import axios from "axios"

export interface Course {
  id: string
  created_at: string
  updated_at: string
  name: string
  deleted_at: string | null
  slug: string
}

export const fetchCourses = async (): Promise<Array<Course>> => {
  const data = (await axios.get("/api/v0/course-material/courses", { responseType: "json" })).data
  return data
}

export interface Organization {
  id: string
  created_at: string
  updated_at: string
  name: string
  deleted_at: string | null
}

export const fetchOrganizations = async (): Promise<Array<Organization>> => {
  const data = (await axios.get("/api/v0/course-material/organizations", { responseType: "json" }))
    .data
  return data
}

export const fetchOrganizationCourses = async (organizationId: string): Promise<Array<Course>> => {
  const data = (
    await axios.get(`/api/v0/course-material/organizations/${organizationId}/courses`, {
      responseType: "json",
    })
  ).data
  return data
}

export interface CoursePage {
  id: string
  created_at: Date
  updated_at: Date
  course_id: string
  content: Block<unknown>[]
  url_path: string
  title: string
  deleted_at: string | null
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
    await axios.get(`/api/v0/course-material/courses/${courseSlug}/page-by-path/${path}`, {
      responseType: "json",
    })
  ).data
  return data
}

export const fetchAllCoursePages = async (courseId: string): Promise<CoursePage[]> => {
  const data = (
    await axios.get(`/api/v0/course-material/courses/${courseId}/pages`, { responseType: "json" })
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
  created_at: string
  updated_at: string
  name: string
  course_id: string
  page_id: string
  deadline: null
  deleted_at: string | null
  score_maximum: number
}

export interface ExerciseStatus {
  score_given?: number
  activity_progress: string
  grading_progress: string
}

export const fetchExerciseById = async (id: string): Promise<CourseMaterialExercise> => {
  const data = (
    await axios.get(`/api/v0/course-material/exercises/${id}`, { responseType: "json" })
  ).data
  return data
}
