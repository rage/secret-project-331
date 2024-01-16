type Vec<Regrading> = Array<{
  id: string
  created_at: string
  updated_at: string
  regrading_started_at: string | null
  regrading_completed_at: string | null
  total_grading_progress: GradingProgress
  user_points_update_strategy: UserPointsUpdateStrategy
  user_id: string | null
}>
