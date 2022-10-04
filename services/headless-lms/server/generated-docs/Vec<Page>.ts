type Vec<Page> = Array<{
  id: string
  created_at: Date
  updated_at: Date
  course_id: string | null
  exam_id: string | null
  chapter_id: string | null
  url_path: string
  title: string
  deleted_at: Date | null
  content: unknown
  order_number: number
  copied_from: string | null
  unlisted: boolean
}>
