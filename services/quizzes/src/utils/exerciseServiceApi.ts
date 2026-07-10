export type GradingProgress = "Failed" | "NotReady" | "PendingManual" | "Pending" | "FullyGraded"

export interface ExerciseTaskGradingResult {
  feedback_json: unknown
  feedback_text: string | null
  grading_progress: GradingProgress
  score_given: number
  score_maximum: number
}

export interface ExerciseServiceInfoApi {
  service_name: string
  user_interface_iframe_path: string
  grade_endpoint_path: string
  public_spec_endpoint_path: string
  model_solution_spec_endpoint_path: string
  csv_export_definitions_endpoint_path?: string | null
  csv_export_answers_endpoint_path?: string | null
}

export interface SpecRequest {
  request_id: string
  private_spec: unknown
  upload_url: string | null
}

export type StudentExerciseTaskSubmissionResult = Record<string, unknown>

const GRADING_PROGRESS_VALUES = new Set<GradingProgress>([
  "Failed",
  "NotReady",
  "PendingManual",
  "Pending",
  "FullyGraded",
])

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

export function isExerciseTaskGradingResult(value: unknown): value is ExerciseTaskGradingResult {
  if (!isObject(value)) {
    return false
  }
  return (
    (value.feedback_json === null || typeof value.feedback_json !== "undefined") &&
    (typeof value.feedback_text === "string" || value.feedback_text === null) &&
    typeof value.score_given === "number" &&
    typeof value.score_maximum === "number" &&
    typeof value.grading_progress === "string" &&
    GRADING_PROGRESS_VALUES.has(value.grading_progress as GradingProgress)
  )
}

export function isExerciseServiceInfoApi(value: unknown): value is ExerciseServiceInfoApi {
  if (!isObject(value)) {
    return false
  }
  return (
    typeof value.service_name === "string" &&
    typeof value.user_interface_iframe_path === "string" &&
    typeof value.grade_endpoint_path === "string" &&
    typeof value.public_spec_endpoint_path === "string" &&
    typeof value.model_solution_spec_endpoint_path === "string" &&
    (typeof value.csv_export_definitions_endpoint_path === "undefined" ||
      typeof value.csv_export_definitions_endpoint_path === "string" ||
      value.csv_export_definitions_endpoint_path === null) &&
    (typeof value.csv_export_answers_endpoint_path === "undefined" ||
      typeof value.csv_export_answers_endpoint_path === "string" ||
      value.csv_export_answers_endpoint_path === null)
  )
}

export function isSpecRequest(value: unknown): value is SpecRequest {
  if (!isObject(value)) {
    return false
  }
  return (
    typeof value.request_id === "string" &&
    "private_spec" in value &&
    (typeof value.upload_url === "string" || value.upload_url === null)
  )
}
