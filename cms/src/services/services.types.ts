interface DatabaseItem {
  id: string
  created_at: string
  updated_at: string
}

/**
 * DELETE Response
 * `${API_URL}/api/v0/pages/${page_id}`
 * GET
 * `${API_URL}/api/v0/courses/${course_id}/pages
 */
export interface Page extends DatabaseItem {
  course_id: string
  content: Array<any> // Wordpress content object, figure out type
  url_path: string
  title: string
  deleted: boolean
}

/**
 * GET, PUT Response, POST Response
 * `${API_URL}/api/v0/pages/${page_id}`
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
  assignment: Array<any> | null
  deleted: boolean
  spec: any | null
  spec_file_id: string | null
}

/**
 * PUT
 * `${API_URL}/api/v0/pages/${page_id}`
 */
export interface PageUpdate {
  page_id: string
  content: Array<any>
  url_path: string
  title: string
  exercises: Array<PageUpdateExercise>
}

export interface PageUpdateExercise {
  id: string
  name: string
  exercise_items: Array<PageUpdateExerciseItem>
}

export interface PageUpdateExerciseItem {
  id: string
  exercise_type: string
  assignment: Array<any>
  spec: any
}

/**
 * POST
 * `${API_URL}/api/v0/pages/${page_id}`
 */
export interface NewPage {
  content: Array<any>
  url_path: string
  title: string
  course_id: string
  exercises: Array<PageUpdateExercise>
}

/**
 * GET
 * `${API_URL}/api/v0/organizations
 */
export interface Organization extends DatabaseItem {
  name: string
  deleted: boolean
}

/**
 * GET
 * `${API_URL}/api/v0/courses
 */
export interface Course extends DatabaseItem {
  name: string
  deleted: boolean
}
