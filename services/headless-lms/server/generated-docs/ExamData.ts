type ExamData = {
  id: string
  name: string
  instructions: unknown
  starts_at: string
  ends_at: string
  ended: boolean
  time_minutes: number
  enrollment_data: ExamEnrollmentData
  language: string
}
