type Vec<Feedback> = Array<{
  id: string
  user_id: string | null
  course_id: string
  page_id: string | null
  feedback_given: string
  selected_text: string | null
  marked_as_read: boolean
  created_at: Date
  blocks: Array<FeedbackBlock>
  page_title: string
  page_url_path: string
}>
