type Option<CourseInstance> = {
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  course_id: string
  starts_at: Date | null
  ends_at: Date | null
  name: string | null
  description: string | null
  teacher_in_charge_name: string
  teacher_in_charge_email: string
  support_email: string | null
} | null
