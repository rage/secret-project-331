type Vec<ChapterWithStatus> = Array<{
  id: string
  created_at: Date
  updated_at: Date
  name: string
  course_id: string
  deleted_at: Date | null
  chapter_number: number
  front_page_id: string | null
  opens_at: Date | null
  status: ChapterStatus
}>
