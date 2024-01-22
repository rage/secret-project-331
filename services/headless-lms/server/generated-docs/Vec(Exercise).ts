type Vec<Exercise> = Array<{
  id: string
  created_at: string
  updated_at: string
  name: string
  course_id: string | null
  exam_id: string | null
  page_id: string
  chapter_id: string | null
  deadline: string | null
  deleted_at: string | null
  score_maximum: number
  order_number: number
  copied_from: string | null
  max_tries_per_slide: number | null
  limit_number_of_tries: boolean
  needs_peer_review: boolean
  use_course_default_peer_review_config: boolean
  exercise_language_group_id: string | null
}>
