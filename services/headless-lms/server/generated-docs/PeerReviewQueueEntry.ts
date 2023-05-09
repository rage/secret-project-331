type PeerReviewQueueEntry = {
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  user_id: string
  exercise_id: string
  course_instance_id: string
  receiving_peer_reviews_exercise_slide_submission_id: string
  received_enough_peer_reviews: boolean
  peer_review_priority: number
  removed_from_queue_for_unusual_reason: boolean
}
