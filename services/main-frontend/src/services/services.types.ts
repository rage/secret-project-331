interface DatabaseItem {
  id: string
  created_at: string
  updated_at: string
}

/**
 * DELETE Response
 * `${API_URL}/api/v0/main-frontend/pages/${page_id}`
 * GET
 * `${API_URL}/api/v0/main-frontend/courses/${course_id}/pages
 */
export interface Page extends DatabaseItem {
  course_id: string
  content: unknown[]
  url_path: string
  title: string
  deleted_at: string | null
  course_part_id: string | null
}

/**
 * GET, PUT Response, POST Response
 * `${API_URL}/api/v0/main-frontend/pages/${page_id}`
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
 * `${API_URL}/api/v0/main-frontend/pages/${page_id}`
 */
export interface PageUpdate {
  page_id?: string
  content: unknown[]
  url_path: string
  title: string
  course_part_id: string | null
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
 * `${API_URL}/api/v0/main-frontend/pages/${page_id}`
 */
export interface NewPage {
  content: unknown[]
  url_path: string
  title: string
  course_id: string
  course_part_id: string | null
  // If set, set this page to be the front page of this course part.
  front_page_of_course_part_id?: string
}

/**
 * GET
 * `${API_URL}/api/v0/main-frontend/organizations
 */
export interface Organization extends DatabaseItem {
  name: string
  deleted_at: string | null
}

/**
 * GET
 * `${API_URL}/api/v0/main-frontend/courses
 */
export interface Course extends DatabaseItem {
  name: string
  deleted_at: string | null
  slug: string
  organization_id: string
}

/**
 * POST
 * `${API_URL}/api/v0/main-frontend/courses
 */
export interface NewCourse {
  name: string
  slug: string
  organization_id: string
}

/**
 * POST
 * `${API_URL}/api/v0/main-frontend/courses/:course_id
 */
export interface CourseUpdate {
  name: string
}

/**
 * GET
 * `${API_URL}/api/v0/main-frontend/courses/:course_id/structure
 */
export interface CourseOverview {
  course: Course
  pages: Page[]
  course_parts: CoursePart[]
}

export interface CoursePart extends DatabaseItem {
  name: string
  course_id: string
  deleted_at: string | null
  part_number: number
  page_id: string | null
}

/**
 * POST /api/v0/main-frontend/course-parts
 */
export interface NewCoursePart {
  name: string
  course_id: string
  part_number: number
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
