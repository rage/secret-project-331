interface DatabaseItem {
  id: string
  created_at: Date
  updated_at: Date
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
  deleted_at: Date | null
  course_part_id: string | null
}

/**
 * GET
 * `${API_URL}/api/v0/main-frontend/exercises/{exercise_id}/submissions`
 */
export interface ExerciseSubmissions {
  data: Array<Submission>
  total_pages: number
}

/**
 * GET, PUT Response, POST Response
 * `${API_URL}/api/v0/main-frontend/pages/${page_id}`
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
  deleted_at: Date | null
}

/**
 * GET
 * `${API_URL}/api/v0/main-frontend/courses
 */
export interface Course extends DatabaseItem {
  name: string
  deleted_at: Date | null
  slug: string
  organization_id: string
}

export interface Exercise extends DatabaseItem {
  course_id: string
  deleted_at: Date | null
  name: string
  deadline: Date | null
  page_id: string
  score_maximum: number
  order_number: number
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
  deleted_at: Date | null
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

export interface Submission extends DatabaseItem {
  course_id: string
  course_instance_id: string
  deleted_at: Date | null
  data_json: unknown
  exercise_id: string
  exercise_task_id: string
  grading_id: string
  metadata: unknown
  user_id: string
}
