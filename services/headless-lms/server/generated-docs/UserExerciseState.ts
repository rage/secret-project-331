type UserExerciseState = {
  id: string
  user_id: string
  exercise_id: string
  course_instance_id: string | null
  exam_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  score_given: number | null
  grading_progress: GradingProgress
  activity_progress: ActivityProgress
  reviewing_stage: ReviewingStage
  selected_exercise_slide_id: string | null
}
