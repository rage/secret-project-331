type Vec<Regrading> = Array<{
  id: string
  created_at: Date
  updated_at: Date
  regrading_started_at: Date | null
  regrading_completed_at: Date | null
  total_grading_progress: GradingProgress
  user_points_update_strategy: UserPointsUpdateStrategy
  user_id: string | null
}>
