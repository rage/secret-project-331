import { BlockInstance } from "@wordpress/blocks"

interface DatabaseItem {
  id: string
  created_at: string
  updated_at: string
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
  deleted_at: string | null
  chapter_id: string | null
}

/**
 * GET, PUT Response, POST Response
 * `${API_URL}/api/v0/cms/pages/${page_id}`
 */
export interface PageWithExercises extends DatabaseItem, Page {
  exercises: Array<ExerciseWithExerciseItems>
}

export interface ExerciseWithExerciseItems extends DatabaseItem {
  course_id: string
  deleted_at: string | null
  name: string
  deadline: string | null
  page_id: string
  exercise_items: Array<ExerciseItem>
}

export interface ExerciseItem extends DatabaseItem {
  exercise_id: string
  exercise_type: string
  assignment: Array<unknown> | null
  deleted_at: string | null
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
  exercise_items: Array<PageUpdateExerciseItem>
}

export interface PageUpdateExerciseItem {
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
  deleted_at: string | null
}

/**
 * GET
 * `${API_URL}/api/v0/cms/courses
 */
export interface Course extends DatabaseItem {
  name: string
  deleted_at: string | null
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
  deleted_at: string | null
  chapter_number: number
  page_id: string | null
}

/**
 * POST /api/v0/cms/chapters
 */
export interface NewChapter {
  name: string
  course_id: string
  chapter_number: number
  page_id: string | null
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
