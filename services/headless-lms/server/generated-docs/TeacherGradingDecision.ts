type TeacherGradingDecision = {
  id: string
  user_exercise_state_id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  score_given: number
  teacher_decision: TeacherDecisionType
}
