type ExamData = {
  id: string
  name: string
  instructions: unknown
  starts_at: Date
  ends_at: Date
  time_minutes: number
  enrollment_data: ExamEnrollmentData
}
