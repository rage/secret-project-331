export type UserRole =
  | "Reviewer"
  | "Assistant"
  | "Teacher"
  | "Admin"
  | "CourseOrExamCreator"
  | "MaterialViewer"
  | "TeachingAndLearningServices"
  | "StatsViewer"

export type Action =
  | { type: "view_material" }
  | { type: "view" }
  | { type: "edit" }
  | { type: "grade" }
  | { type: "teach" }
  | { type: "download" }
  | { type: "duplicate" }
  | { type: "delete_answer" }
  | { type: "edit_role"; variant: UserRole }
  | { type: "create_courses_or_exams" }
  | { type: "usually_unacceptable_deletion" }
  | { type: "upload_file" }
  | { type: "view_user_progress_or_details" }
  | { type: "view_internal_course_structure" }
  | { type: "view_stats" }
  | { type: "administrate" }

export interface ActionOnResource {
  action: Action
  resource: Resource
}

export type Resource =
  | { type: "global_permissions" }
  | { type: "chapter"; id: string }
  | { type: "course"; id: string }
  | { type: "course_instance"; id: string }
  | { type: "exam"; id: string }
  | { type: "exercise"; id: string }
  | { type: "exercise_slide_submission"; id: string }
  | { type: "exercise_task"; id: string }
  | { type: "exercise_task_grading"; id: string }
  | { type: "exercise_task_submission"; id: string }
  | { type: "organization"; id: string }
  | { type: "page"; id: string }
  | { type: "study_registry"; id: string }
  | { type: "any_course" }
  | { type: "role" }
  | { type: "user" }
  | { type: "playground_example" }
  | { type: "exercise_service" }

export interface CreateAccountDetails {
  email: string
  first_name: string
  last_name: string
  language: string
  password: string
  password_confirmation: string
  country: string
  email_communication_consent: boolean
}

export type LoginResponse =
  | { type: "success" }
  | { type: "requires_email_verification"; email_verification_token: string }
  | { type: "failed" }

export interface UserInfo {
  user_id: string
  first_name: string | null
  last_name: string | null
}

export const isLoginResponse = (value: unknown): value is LoginResponse => {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return false
  }
  const type = (value as { type?: unknown }).type
  if (type === "success" || type === "failed") {
    return true
  }
  return (
    type === "requires_email_verification" &&
    typeof (value as { email_verification_token?: unknown }).email_verification_token === "string"
  )
}

export const isUserInfo = (value: unknown): value is UserInfo => {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.user_id === "string" &&
    (typeof candidate.first_name === "string" || candidate.first_name === null) &&
    (typeof candidate.last_name === "string" || candidate.last_name === null)
  )
}
