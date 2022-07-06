type UserCourseInstanceProgress = {
  course_module_id: string
  course_module_name: string
  course_module_order_number: number
  score_given: number
  score_required: number | null
  score_maximum: number | null
  total_exercises: number | null
  attempted_exercises: number | null
  attempted_exercises_required: number | null
}
