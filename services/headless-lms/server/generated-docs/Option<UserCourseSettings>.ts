type Option<UserCourseSettings> = {
  user_id: string
  course_language_group_id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  current_course_id: string
  current_course_instance_id: string
} | null
