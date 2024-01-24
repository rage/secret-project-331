type Vec<PeerReviewQuestion> = Array<{
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  peer_review_config_id: string
  order_number: number
  question: string
  question_type: PeerReviewQuestionType
  answer_required: boolean
  weight: number
}>
