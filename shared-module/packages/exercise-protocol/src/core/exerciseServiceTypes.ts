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
  /**
   * Whether this service can be answered from a native (non-browser) client. Declaring it is what
   * makes the service visible to the exercise-services client API, so a service that omits it is
   * never offered to such a client.
   */
  supports_native_client?: boolean
  /**
   * Whether this service's answers consist of uploaded files rather than JSON. Not the
   * native-client flag: it says nothing about which clients can answer the exercise, only what an
   * answer to it is made of. Gates teacher-facing tooling that only makes sense for file answers,
   * such as the answer-file archive download.
   */
  produces_file_answers?: boolean
  /**
   * Whether this service declares which stored files its specs reference. Declaring means two
   * things: the exercise editor lists the private spec's files in `current-state`'s `files`, and
   * the public-spec and model-solution endpoints answer with `{ spec, files }` instead of the bare
   * spec.
   *
   * Declaring is what lets the host reclaim files this service uploaded and no longer uses — it
   * cannot read a spec, so without declarations it has no evidence any file is unused and keeps
   * every one forever. Opt-in for that reason: a service that omits this loses nothing.
   */
  declares_spec_files?: boolean
}

/**
 * What the public-spec and model-solution endpoints of a service that declares its spec files
 * return, in place of the bare spec.
 */
export interface DerivedSpecResponse<S = unknown> {
  spec: S | null
  /** Host file ids the derived spec references. Files uploaded via `SpecRequest.upload_url` count. */
  files: string[]
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

/** One host-stored file that an answer consists of, as the host's own API returns it. */
export interface AnswerFile {
  id: string
  name: string
  mime: string
  /** Absent for a file stored before sizes were recorded; the host cannot back-fill it. */
  size_bytes?: number
  /** The file's position in the answer. The order is part of the answer. */
  order_number: number
  /** Host download URL. Needs no authentication; do not persist it. */
  url: string
}

export interface ExerciseTaskSubmission {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  exercise_slide_submission_id: string
  exercise_task_id: string
  exercise_slide_id: string
  answer_kind: "json" | "file"
  /**
   * The exercise service's own JSON: the whole answer for a `json` answer, the service's metadata
   * about the files for a `file` one.
   */
  data_json: unknown | null
  /** The files the answer consists of. Absent when it has none. */
  data_files?: AnswerFile[]
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
