type PeerReview = {
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  course_instance_id: string
  exercise_id: string | null
}
