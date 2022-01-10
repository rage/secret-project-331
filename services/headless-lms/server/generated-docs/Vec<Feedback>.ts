type Vec<Feedback> = Array<{
  id: string
  user_id: string | null
  course_id: string
  feedback_given: string
  selected_text: string | null
  marked_as_read: boolean
  created_at: Date
  blocks: Array<FeedbackBlock>
}>
