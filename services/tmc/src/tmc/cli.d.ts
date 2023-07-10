// https://raw.githubusercontent.com/rage/tmc-langs-rust/0.31.2/crates/tmc-langs-cli/bindings.d.ts

export type Locale = string

export type Compression = "tar" | "zip" | "zstd"

/** @see {isCliOutput} ts-auto-guard:type-guard */
export type CliOutput =
  | ({ "output-kind": "output-data" } & OutputData)
  | ({ "output-kind": "status-update" } & StatusUpdateData)
  | ({ "output-kind": "notification" } & Notification)

export interface OutputData {
  status: Status
  message: string
  result: OutputResult
  data: DataKind | null
}

export type StatusUpdateData =
  | ({ "update-data-kind": "client-update-data" } & StatusUpdate<ClientUpdateData>)
  | ({ "update-data-kind": "none" } & StatusUpdate<null>)

export interface Notification {
  "notification-kind": NotificationKind
  message: string
}

export type Status = "finished" | "crashed"

export type OutputResult =
  | "logged-in"
  | "logged-out"
  | "not-logged-in"
  | "error"
  | "executed-command"

export type ClientUpdateData =
  | { "client-update-data-kind": "exercise-download"; id: number; path: string }
  | ({ "client-update-data-kind": "posted-submission" } & NewSubmission)

export interface StatusUpdate<T> {
  finished: boolean
  message: string
  "percent-done": number
  time: bigint
  data: T | null
}

export type NotificationKind = "warning" | "info"

export type DataKind =
  | { "output-data-kind": "error"; "output-data": { kind: Kind; trace: Array<string> } }
  | { "output-data-kind": "validation"; "output-data": StyleValidationResult }
  | { "output-data-kind": "available-points"; "output-data": Array<string> }
  | { "output-data-kind": "exercises"; "output-data": Array<string> }
  | {
      "output-data-kind": "exercise-packaging-configuration"
      "output-data": ExercisePackagingConfiguration
    }
  | { "output-data-kind": "local-exercises"; "output-data": Array<LocalExercise> }
  | { "output-data-kind": "refresh-result"; "output-data": RefreshData }
  | { "output-data-kind": "test-result"; "output-data": RunResult }
  | { "output-data-kind": "exercise-desc"; "output-data": ExerciseDesc }
  | { "output-data-kind": "updated-exercises"; "output-data": Array<UpdatedExercise> }
  | {
      "output-data-kind": "exercise-download"
      "output-data": DownloadOrUpdateCourseExercisesResult
    }
  | { "output-data-kind": "combined-course-data"; "output-data": CombinedCourseData }
  | { "output-data-kind": "course-details"; "output-data": CourseDetails }
  | { "output-data-kind": "course-exercises"; "output-data": Array<CourseExercise> }
  | { "output-data-kind": "course-data"; "output-data": CourseData }
  | { "output-data-kind": "courses"; "output-data": Array<Course> }
  | { "output-data-kind": "exercise-details"; "output-data": ExerciseDetails }
  | { "output-data-kind": "submissions"; "output-data": Array<Submission> }
  | { "output-data-kind": "update-result"; "output-data": UpdateResult }
  | { "output-data-kind": "organization"; "output-data": Organization }
  | { "output-data-kind": "organizations"; "output-data": Array<Organization> }
  | { "output-data-kind": "reviews"; "output-data": Array<Review> }
  | { "output-data-kind": "token"; "output-data": unknown }
  | { "output-data-kind": "new-submission"; "output-data": NewSubmission }
  | {
      "output-data-kind": "submission-feedback-response"
      "output-data": SubmissionFeedbackResponse
    }
  | { "output-data-kind": "submission-finished"; "output-data": SubmissionFinished }
  | { "output-data-kind": "config-value"; "output-data": ConfigValue }
  | { "output-data-kind": "tmc-config"; "output-data": TmcConfig }
  | { "output-data-kind": "compressed-project-hash"; "output-data": string }
  | { "output-data-kind": "submission-sandbox"; "output-data": string }

export interface NewSubmission {
  show_submission_url: string
  paste_url: string
  submission_url: string
}

export type Kind =
  | "generic"
  | "forbidden"
  | "not-logged-in"
  | "connection-error"
  | "obsolete-client"
  | "invalid-token"
  | {
      "failed-exercise-download": {
        completed: Array<ExerciseDownload>
        skipped: Array<ExerciseDownload>
        failed: Array<[ExerciseDownload, Array<string>]>
      }
    }

export interface StyleValidationResult {
  strategy: StyleValidationStrategy
  validationErrors: Record<string, Array<StyleValidationError>> | null
}

export interface ExerciseDownload {
  id: number
  "course-slug": string
  "exercise-slug": string
  path: string
}

export type StyleValidationStrategy = "FAIL" | "WARN" | "DISABLED"

export interface StyleValidationError {
  column: number
  line: number
  message: string
  sourceName: string
}

export interface ExercisePackagingConfiguration {
  student_file_paths: Array<string>
  exercise_file_paths: Array<string>
}

export interface LocalExercise {
  "exercise-slug": string
  "exercise-path": string
}

export interface RefreshData {
  "new-cache-path": string
  "course-options": object
  exercises: Array<RefreshExercise>
}

/** @see {isRunResult} ts-auto-guard:type-guard */
export interface RunResult {
  status: RunStatus
  testResults: Array<TestResult>
  logs: Record<string, string>
}

export interface ExerciseDesc {
  name: string
  tests: Array<TestDesc>
}

export interface RefreshExercise {
  name: string
  checksum: string
  points: Array<string>
  "sandbox-image": string
  "tmcproject-yml": TmcProjectYml | null
}

export type RunStatus =
  | "PASSED"
  | "TESTS_FAILED"
  | "COMPILE_FAILED"
  | "TESTRUN_INTERRUPTED"
  | "GENERIC_ERROR"

export interface TestResult {
  name: string
  successful: boolean
  points: Array<string>
  message: string
  exception: Array<string>
}

export interface TestDesc {
  name: string
  points: Array<string>
}

export interface TmcProjectYml {
  extra_student_files: Array<string>
  extra_exercise_files: Array<string>
  force_update: Array<string>
  tests_timeout_ms?: bigint
  fail_on_valgrind_error?: boolean
  minimum_python_version?: PythonVer
  sandbox_image?: string
}

export interface UpdatedExercise {
  id: number
}

export interface DownloadOrUpdateCourseExercisesResult {
  downloaded: Array<ExerciseDownload>
  skipped: Array<ExerciseDownload>
  failed?: Array<[ExerciseDownload, Array<string>]>
}

export interface CombinedCourseData {
  details: CourseDetails
  exercises: Array<CourseExercise>
  settings: CourseData
}

export interface CourseDetails {
  id: number
  name: string
  title: string
  description: string | null
  details_url: string
  unlock_url: string
  reviews_url: string
  comet_url: string
  spyware_urls: Array<string>
  unlockables: Array<string>
  exercises: Array<Exercise>
}

export interface CourseExercise {
  id: number
  available_points: Array<ExercisePoint>
  awarded_points: Array<string>
  name: string
  publish_time: string | null
  solution_visible_after: string | null
  deadline: string | null
  soft_deadline: string | null
  disabled: boolean
  unlocked: boolean
}

export interface CourseData {
  name: string
  hide_after: string | null
  hidden: boolean
  cache_version: number | null
  spreadsheet_key: string | null
  hidden_if_registered_after: string | null
  refreshed_at: string | null
  locked_exercise_points_visible: boolean
  description: string | null
  paste_visibility: number | null
  formal_name: string | null
  certificate_downloadable: boolean | null
  certificate_unlock_spec: string | null
  organization_id: number | null
  disabled_status: string | null
  title: string | null
  material_url: string | null
  course_template_id: number | null
  hide_submission_results: boolean
  external_scoreboard_url: string | null
  organization_slug: string | null
}

export interface Course {
  id: number
  name: string
  title: string
  description: string | null
  details_url: string
  unlock_url: string
  reviews_url: string
  comet_url: string
  spyware_urls: Array<string>
}

export interface ExerciseDetails {
  course_name: string
  course_id: number
  code_review_requests_enabled: boolean
  run_tests_locally_action_enabled: boolean
  exercise_name: string
  exercise_id: number
  unlocked_at: string | null
  deadline: string | null
  submissions: Array<ExerciseSubmission>
}

export interface Submission {
  id: number
  user_id: number
  pretest_error: string | null
  created_at: string
  exercise_name: string
  course_id: number
  processed: boolean
  all_tests_passed: boolean
  points: string | null
  processing_tried_at: string | null
  processing_began_at: string | null
  processing_completed_at: string | null
  times_sent_to_sandbox: number
  processing_attempts_started_at: string
  params_json: string | null
  requires_review: boolean
  requests_review: boolean
  reviewed: boolean
  message_for_reviewer: string
  newer_submission_reviewed: boolean
  review_dismissed: boolean
  paste_available: boolean
  message_for_paste: string
  paste_key: string | null
}

export interface UpdateResult {
  created: Array<Exercise>
  updated: Array<Exercise>
}

export interface Organization {
  name: string
  information: string
  slug: string
  logo_path: string
  pinned: boolean
}

export interface Review {
  submission_id: number
  exercise_name: string
  id: number
  marked_as_read: boolean
  reviewer_name: string
  review_body: string
  points: Array<string>
  points_not_awarded: Array<string>
  url: string
  update_url: string
  created_at: string
  updated_at: string
}

export interface Exercise {
  id: number
  name: string
  locked: boolean
  deadline_description: string | null
  deadline: string | null
  soft_deadline: string | null
  soft_deadline_description: string | null
  checksum: string
  return_url: string
  zip_url: string
  returnable: boolean
  requires_review: boolean
  attempted: boolean
  completed: boolean
  reviewed: boolean
  all_review_points_given: boolean
  memory_limit: number | null
  runtime_params: Array<string>
  valgrind_strategy: string | null
  code_review_requests_enabled: boolean
  run_tests_locally_action_enabled: boolean
  latest_submission_url: string | null
  latest_submission_id: number | null
  solution_zip_url: string | null
}

export interface ExerciseSubmission {
  exercise_name: string
  id: number
  user_id: number
  course_id: number
  created_at: string
  all_tests_passed: boolean
  points: string | null
  submitted_zip_url: string
  paste_url: string | null
  processing_time: number | null
  reviewed: boolean
  requests_review: boolean
}

export interface ExercisePoint {
  id: number
  exercise_id: number
  name: string
  requires_review: boolean
}

export interface PythonVer {
  major: number
  minor: number | null
  patch: number | null
}

export interface TmcConfig {
  projects_dir: string
}

export type ConfigValue = unknown | null | string

export interface SubmissionFinished {
  api_version: number
  all_tests_passed: boolean | null
  user_id: number
  login: string
  course: string
  exercise_name: string
  status: SubmissionStatus
  points: Array<string>
  valgrind: string | null
  submission_url: string
  solution_url: string | null
  submitted_at: string
  processing_time: number | null
  reviewed: boolean
  requests_review: boolean
  paste_url: string | null
  message_for_paste: string | null
  missing_review_points: Array<string>
  test_cases: Array<TestCase> | null
  feedback_questions: Array<SubmissionFeedbackQuestion> | null
  feedback_answer_url: string | null
  error: string | null
  validations: StyleValidationResult | null
}

export interface SubmissionFeedbackResponse {
  api_version: number
  status: SubmissionStatus
}

export type SubmissionStatus = "processing" | "fail" | "ok" | "error" | "hidden"

export interface SubmissionFeedbackQuestion {
  id: number
  question: string
  kind: SubmissionFeedbackKind
}

export interface TestCase {
  name: string
  successful: boolean
  message: string | null
  exception: Array<string> | null
  detailed_message: string | null
}

export type SubmissionFeedbackKind = "Text" | { IntRange: { lower: number; upper: number } }
