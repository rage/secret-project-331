type Vec<PeerReviewQuestion> = Array<{
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  peer_review_id: string
  order_number: number
  question: string
  question_type: PeerReviewQuestionType
}>
