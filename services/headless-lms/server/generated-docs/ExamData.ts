type ExamData = {
  id: string
  name: string
  instructions: string
  starts_at: Date
  ends_at: Date
  time_minutes: number
  enrollment_data: ExamEnrollmentData
}
