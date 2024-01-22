type Exam = {
  id: string
  name: string
  instructions: unknown
  page_id: string
  courses: Array<Course>
  starts_at: string | null
  ends_at: string | null
  time_minutes: number
  minimum_points_treshold: number
  language: string
}
