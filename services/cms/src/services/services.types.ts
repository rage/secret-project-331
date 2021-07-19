import { BlockInstance } from "@wordpress/blocks"

interface DatabaseItem {
  id: string
  created_at: Date
  updated_at: Date
}

/**
 * DELETE Response
 * `${API_URL}/api/v0/cms/pages/${page_id}`
 * GET
 * `${API_URL}/api/v0/cms/courses/${course_id}/pages
 */
export interface Page extends DatabaseItem {
  course_id: string
  content: BlockInstance[]
  url_path: string
  title: string
  deleted_at: Date | null
  chapter_id: string | null
}

/**
 * GET, PUT Response, POST Response
 * `${API_URL}/api/v0/cms/pages/${page_id}`
 */
export interface PageWithExercises extends DatabaseItem, Page {
  exercises: Array<ExerciseWithExerciseTasks>
}

export interface ExerciseWithExerciseTasks extends DatabaseItem {
  course_id: string
  deleted_at: Date | null
  name: string
  deadline: string | null
  page_id: string
  exercise_tasks: Array<ExerciseTask>
}

export interface ExerciseTask extends DatabaseItem {
  exercise_id: string
  exercise_type: string
  assignment: Array<unknown> | null
  deleted_at: Date | null
  spec: string | null
  spec_file_id: string | null
}

/**
 * PUT
 * `${API_URL}/api/v0/cms/pages/${page_id}`
 */
export interface PageUpdate {
  page_id?: string
  content: BlockInstance[]
  url_path: string
  title: string
  chapter_id: string | null
}

export interface PageUpdateExercise {
  id: string
  name: string
  exercise_tasks: Array<PageUpdateExerciseTask>
}

export interface PageUpdateExerciseTask {
  id: string
  exercise_type: string
  assignment: Array<unknown>
  spec: string | null
}

/**
 * POST
 * `${API_URL}/api/v0/cms/pages/${page_id}`
 */
export interface NewPage {
  content: BlockInstance[]
  url_path: string
  title: string
  course_id: string
  chapter_id: string | null
  // If set, set this page to be the front page of this Chapter.
  front_page_of_chapter_id?: string
}

/**
 * GET
 * `${API_URL}/api/v0/cms/organizations
 */
export interface Organization extends DatabaseItem {
  name: string
  deleted_at: Date | null
}

/**
 * GET
 * `${API_URL}/api/v0/cms/courses
 */
export interface Course extends DatabaseItem {
  name: string
  deleted_at: Date | null
  slug: string
  organization_id: string
}

/**
 * POST
 * `${API_URL}/api/v0/cms/courses
 */
export interface NewCourse {
  name: string
  slug: string
  organization_id: string
}

export type VariantStatus = "draft" | "upcoming" | "active" | "ended"

/**
 * GET
 * `/{API_URL/api/v0/cms/course-instances/:course_instance_id}`
 */
export interface CourseInstance extends DatabaseItem {
  course_id: string
  starts_at?: Date
  ends_at?: Date
  name?: string
  description?: string
  variant_status: VariantStatus
}

/**
 * GET
 * `${API_URL}/api/v0/cms/courses/:course_id/structure
 */
export interface CourseOverview {
  course: Course
  pages: Page[]
  chapters: Chapter[]
}

export interface Chapter extends DatabaseItem {
  name: string
  course_id: string
  deleted_at: Date | null
  chapter_image_url: string
  chapter_number: number
  front_page_id: string | null
}

/**
 * POST /api/v0/cms/chapters
 */
export interface NewChapter {
  name: string
  course_id: string
  chapter_number: number
  front_page_id: string | null
}

export interface ChapterUpdate {
  name: string
  chapter_image_url: string | null
  chapter_number: number
  front_page_id: string | null
}

export interface CourseSubmissionCount {
  date: string
  count: number
}

export interface CourseSubmissionCountByWeekdayAndHour {
  isodow: number
  hour: number
  count: number
}

export interface EmailTemplate extends DatabaseItem {
  deleted_at: Date | null
  content: BlockInstance[] | null
  name: string
  subject: string | null
  exercise_completions_threshold: number | null
  points_threshold: number | null
  course_instance_id: string
}

export interface EmailTemplateNew {
  name: string
}

export interface EmailTemplateUpdate {
  name: string
  subject: string
  content: BlockInstance[]
  exercise_completions_threshold?: number
  points_threshold?: number
}
