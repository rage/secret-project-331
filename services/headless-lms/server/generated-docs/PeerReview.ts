type PeerReview = {
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  course_id: string
  exercise_id: string | null
  peer_reviews_to_give: number
  peer_reviews_to_receive: number
}
