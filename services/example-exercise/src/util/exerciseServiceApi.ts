export type ExerciseTaskGradingResult = {
  feedback_json: unknown
  feedback_text: string | null
  grading_progress: "Failed" | "NotReady" | "PendingManual" | "Pending" | "FullyGraded"
  score_given: number
  score_maximum: number
}

export type ExerciseServiceInfoApi = {
  service_name: string
  user_interface_iframe_path: string
  grade_endpoint_path: string
  public_spec_endpoint_path: string
  model_solution_spec_endpoint_path: string
  csv_export_definitions_endpoint_path?: string | null
  csv_export_answers_endpoint_path?: string | null
}

export type SpecRequest = {
  request_id: string
  private_spec: unknown
  upload_url: string | null
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

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
