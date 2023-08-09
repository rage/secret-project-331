type Option<CourseModuleCompletionCertificate> = {
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  user_id: string
  course_module_id: string
  course_instance_id: string
  name_on_certificate: string
  verification_id: string
} | null
