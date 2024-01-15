type ExamData = {
  id: string
  name: string
  instructions: unknown
  starts_at: Date
  ends_at: Date
  ended: boolean
  time_minutes: number
  enrollment_data: ExamEnrollmentData
  language: string
}
