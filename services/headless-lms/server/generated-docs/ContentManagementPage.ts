type ContentManagementPage = {
  page: Page
  exercises: Array<CmsPageExercise>
  exercise_slides: Array<CmsPageExerciseSlide>
  exercise_tasks: Array<CmsPageExerciseTask>
  peer_reviews: Array<CmsPeerReviewConfig>
  peer_review_questions: Array<CmsPeerReviewQuestion>
  organization_id: string
}
