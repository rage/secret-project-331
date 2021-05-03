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
  deleted: boolean
  course_part_id: string | null
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
  deleted: boolean
  name: string
  deadline: string | null
  page_id: string
  exercise_items: Array<ExerciseItem>
}

export interface ExerciseItem extends DatabaseItem {
  exercise_id: string
  exercise_type: string
  assignment: Array<unknown> | null
  deleted: boolean
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
  course_part_id: string | null
  // If set, set this page to be the front page of this course part.
  front_page_of_course_part_id?: string
}

/**
 * GET
 * `${API_URL}/api/v0/cms/organizations
 */
export interface Organization extends DatabaseItem {
  name: string
  deleted: boolean
}

/**
 * GET
 * `${API_URL}/api/v0/cms/courses
 */
export interface Course extends DatabaseItem {
  name: string
  deleted: boolean
}

/**
 * GET
 * `${API_URL}/api/v0/cms/courses/:course_id/structure
 */
export interface CourseOverview {
  course: Course
  pages: Page[]
  course_parts: CoursePart[]
}

export interface CoursePart extends DatabaseItem {
  name: string
  course_id: string
  deleted: boolean
  part_number: number
  page_id: string | null
}

/**
 * POST /api/v0/cms/course-parts
 */
export interface NewCoursePart {
  name: string
  course_id: string
  part_number: number
  page_id: string | null
}
