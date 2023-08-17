type Vec<OrgExam> = Array<{
  id: string
  name: string
  instructions: unknown
  starts_at: Date | null
  ends_at: Date | null
  time_minutes: number
  organization_id: string
  minimum_points_treshold: number
}>
