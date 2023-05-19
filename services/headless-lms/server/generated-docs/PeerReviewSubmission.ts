type PeerReviewSubmission = {
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  user_id: string
  exercise_id: string
  course_instance_id: string
  peer_review_config_id: string
  exercise_slide_submission_id: string
}
