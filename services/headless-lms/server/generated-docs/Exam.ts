type Exam = {
  id: string
  name: string
  instructions: string
  page_id: string
  courses: Array<Course>
  starts_at: Date | null
  ends_at: Date | null
  time_minutes: number
}
