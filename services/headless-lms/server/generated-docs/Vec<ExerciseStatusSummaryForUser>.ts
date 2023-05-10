type Vec<ExerciseStatusSummaryForUser> = Array<{
  exercise: Exercise
  user_exercise_state: UserExerciseState | null
  exercise_slide_submissions: Array<ExerciseSlideSubmission>
  given_peer_review_submissions: Array<PeerReviewSubmission>
  given_peer_review_question_submissions: Array<PeerReviewQuestionSubmission>
  received_peer_review_submissions: Array<PeerReviewSubmission>
  received_peer_review_question_submissions: Array<PeerReviewQuestionSubmission>
  peer_review_queue_entry: PeerReviewQueueEntry | null
}>
