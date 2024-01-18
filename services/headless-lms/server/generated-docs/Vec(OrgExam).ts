type Vec<OrgExam> = Array<{
  id: string
  name: string
  instructions: unknown
  starts_at: string | null
  ends_at: string | null
  time_minutes: number
  organization_id: string
  minimum_points_treshold: number
}>
