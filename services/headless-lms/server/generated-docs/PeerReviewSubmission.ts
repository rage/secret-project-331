type PeerReviewSubmission = {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  user_id: string
  exercise_id: string
  course_instance_id: string
  peer_review_config_id: string
  exercise_slide_submission_id: string
}
