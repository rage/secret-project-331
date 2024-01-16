type Vec<PageWithExercises> = Array<{
  id: string
  created_at: string
  updated_at: string
  course_id: string | null
  exam_id: string | null
  chapter_id: string | null
  url_path: string
  title: string
  deleted_at: string | null
  content: unknown
  order_number: number
  copied_from: string | null
  hidden: boolean
  page_language_group_id: string | null
  exercises: Array<Exercise>
}>
