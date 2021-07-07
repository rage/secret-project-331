import { courseMaterialClient } from "./courseMaterialClient"

export interface Course {
  id: string
  created_at: Date
  updated_at: Date
  name: string
  deleted_at: Date | null
  slug: string
}

export const fetchCourses = async (): Promise<Array<Course>> => {
  const data = (await courseMaterialClient.get("/courses", { responseType: "json" })).data
  return data
}

export interface Organization {
  id: string
  created_at: Date
  updated_at: Date
  name: string
  deleted_at: Date | null
}

export const fetchOrganizations = async (): Promise<Array<Organization>> => {
  const data = (await courseMaterialClient.get("/organizations", { responseType: "json" })).data
  return data
}

export const fetchOrganizationCourses = async (organizationId: string): Promise<Array<Course>> => {
  const data = (
    await courseMaterialClient.get(`/organizations/${organizationId}/courses`, {
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
  deleted_at: Date | null
  chapter_id: string | null
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
    await courseMaterialClient.get(`/courses/${courseSlug}/page-by-path${path}`, {
      responseType: "json",
    })
  ).data
  return data
}

export type CourseInstanceVariantStatus = "draft" | "upcoming" | "active" | "ended"

export interface CourseInstance {
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: string
  course_id: string
  starts_at: Date | null
  ends_at: Date | null
  name: string | null
  description: string | null
  variant_status: CourseInstanceVariantStatus
}

export const fetchCourseInstance = async (courseId: string): Promise<CourseInstance | null> => {
  const data = (
    await courseMaterialClient.get(`/courses/${courseId}/current-instance`, {
      responseType: "json",
    })
  ).data
  return data
}

export const fetchCourseInstances = async (courseId: string): Promise<Array<CourseInstance>> => {
  const data = (
    await courseMaterialClient.get(`/courses/${courseId}/course-instances`, {
      responseType: "json",
    })
  ).data
  return data
}

export const postCourseInstanceEnrollment = async (courseInstanceId: string): Promise<unknown> => {
  const response = await courseMaterialClient.post(
    `/course-instances/${courseInstanceId}/enroll`,
    null,
    {
      headers: { "Content-Type": "application/json" },
    },
  )
  return response.data
}

export const fetchAllCoursePages = async (courseId: string): Promise<CoursePage[]> => {
  const data = (
    await courseMaterialClient.get(`/courses/${courseId}/pages`, {
      responseType: "json",
    })
  ).data
  return data
}

export interface CourseProgress {
  score_given: number
  score_maximum: number
  total_exercises: number
  completed_exercises: number
}

export const fetchCourseProgress = async (courseInstanceId: string): Promise<CourseProgress> => {
  const data = (await courseMaterialClient.get(`/course-instances/${courseInstanceId}/progress`))
    .data
  return data
}

export interface CourseMaterialExercise {
  exercise: Exercise
  current_exercise_task: CurrentExerciseTask
  exercise_status?: ExerciseStatus
  current_exercise_task_service_info: CurrentExerciseTaskServiceInfo
}

export interface CurrentExerciseTaskServiceInfo {
  exercise_iframe_path: string
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
  created_at: Date
  updated_at: Date
  name: string
  course_id: string
  page_id: string
  deadline: null
  deleted_at: Date | null
  score_maximum: number
}

export interface ExerciseStatus {
  score_given?: number
  activity_progress: string
  grading_progress: string
}

export const fetchExerciseById = async (id: string): Promise<CourseMaterialExercise> => {
  const data = (await courseMaterialClient.get(`/exercises/${id}`, { responseType: "json" })).data
  return data
}

export interface ChapterPagesWithExercises {
  id: string
  created_at: Date
  updated_at: Date
  course_id: string
  chapter_id: string
  content: any
  url_path: string
  title: string
  deleted_at: Date
  exercises: Exercise[]
}

export const fetchChaptersPagesWithExercises = async (
  chapterId: string,
): Promise<ChapterPagesWithExercises[]> => {
  const data = (
    await courseMaterialClient.get(`/chapters/${chapterId}/exercises`, {
      responseType: "json",
    })
  ).data
  return data
}

export interface PageRoutingData {
  url_path: string
  title: string
  chapter_number: string | undefined
  chapter_id: string
}

export const getNextPageRoutingData = async (currentPageId: string): Promise<PageRoutingData> => {
  return (await courseMaterialClient.get(`/pages/${currentPageId}/next-page`)).data
}

export interface ChapterPages {
  id: string
  created_at: Date
  updated_at: Date
  course_id: string
  chapter_id: string
  content: any
  url_path: string
  title: string
  deleted_at: Date
}

export const fetchChaptersPagesExcludeFrontpage = async (
  chapterId: string,
): Promise<ChapterPages[]> => {
  return (await courseMaterialClient.get(`/chapters/${chapterId}/pages-exclude-mainfrontpage`)).data
}

export interface ChapterInTheCourse {
  id: string
  created_at: Date
  updated_at: Date
  name: string
  course_id: string
  deleted_at: Date | null
  chapter_number: number
  front_page_id: string | null
  opens_at: Date | null
  status: "open" | "closed"
}

export const fetchChaptersInTheCourse = async (courseId: string): Promise<ChapterInTheCourse[]> => {
  return (await courseMaterialClient.get(`/courses/${courseId}/chapters`)).data
}

export const fetchPageUrl = async (pageId: string): Promise<string> => {
  return (await courseMaterialClient.get(`/pages/${pageId}/url-path`)).data
}
