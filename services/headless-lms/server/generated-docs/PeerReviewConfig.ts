type PeerReviewConfig = {
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  course_id: string
  exercise_id: string | null
  peer_reviews_to_give: number
  peer_reviews_to_receive: number
  accepting_threshold: number
  processing_strategy: PeerReviewProcessingStrategy
  manual_review_cutoff_in_days: number
  points_are_all_or_nothing: boolean
}
