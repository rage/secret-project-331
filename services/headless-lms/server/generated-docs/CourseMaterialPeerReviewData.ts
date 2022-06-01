type CourseMaterialPeerReviewData = {
  answer_to_review: CourseMaterialPeerReviewDataAnswerToReview | null
  peer_review: PeerReview
  peer_review_questions: Array<PeerReviewQuestion>
  num_peer_reviews_given: number
}
