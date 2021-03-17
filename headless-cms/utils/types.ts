/**
 * `${API_URL}/api/v0/pages/${pageId}`
 */
export interface PageData {
  id: string
  created_at: string
  updated_at: string
  course_id: string
  content: Array<any> // Wordpress content object, figure out type
  url_path: string
  title: string
  deleted: boolean
  exercises: Array<any> // Create exercises type for array
}
