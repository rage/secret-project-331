export interface SpecRequest {
  request_id: string
  private_spec: unknown | null
  upload_url: string | null
}

export interface ExerciseServiceInfoApi {
  service_name: string
  user_interface_iframe_path: string
  grade_endpoint_path: string
  public_spec_endpoint_path: string
  model_solution_spec_endpoint_path: string
  has_custom_view?: boolean
  csv_export_definitions_endpoint_path?: string
  csv_export_answers_endpoint_path?: string
}

export type GradingProgress = "Pending" | "Failed" | "FullyGraded" | "PendingManual" | "NotReady"

export interface ExerciseTaskGradingResult {
  grading_progress: GradingProgress
  score_given: number
  score_maximum: number
  feedback_text: string | null
  feedback_json: unknown | null
  set_user_variables?: Record<string, unknown>
}

export interface ExerciseTaskSubmission {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  exercise_slide_submission_id: string
  exercise_task_id: string
  exercise_slide_id: string
  data_json: unknown | null
  exercise_task_grading_id: string | null
  metadata: unknown | null
}

export interface StudentExerciseTaskSubmissionResult {
  submission: ExerciseTaskSubmission
  grading: ExerciseTaskGrading | null
  model_solution_spec: unknown | null
  exercise_task_exercise_service_slug: string
}

export interface ExerciseTaskGrading {
  id: string
  created_at: string
  updated_at: string
  exercise_slide_submission_id: string
  exercise_task_submission_id: string
  score_given: number
  score_maximum: number
  manually_reviewed: boolean
  grading_progress: GradingProgress
  activity_progress: string
  reviewing_stage: string
  selected_exercise_slide_id: string | null
  feedback_json: unknown | null
  feedback_text: string | null
  deleted_at: string | null
}

export interface RepositoryExercise {
  id: string
  repository_id: string
  part: string
  name: string
  repository_url: string
  checksum: number[]
  download_url: string
}

export interface UserInfo {
  user_id: string
  first_name: string | null
  last_name: string | null
}
