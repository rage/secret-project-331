// VERSION=0.38.1
// https://raw.githubusercontent.com/rage/tmc-langs-rust/0.38.1/crates/tmc-langs-cli/bindings.d.ts

export type Locale = string

/** @see {isCliOutput} ts-auto-guard:type-guard */
export type CliOutput =
  | ({ "output-kind": "output-data" } & OutputData)
  | ({ "output-kind": "status-update" } & StatusUpdateData)
  | ({ "output-kind": "notification" } & Notification)

export type DataKind =
  | { "output-data-kind": "error"; "output-data": { kind: Kind; trace: string[] } }
  | { "output-data-kind": "validation"; "output-data": StyleValidationResult | null }
  | { "output-data-kind": "available-points"; "output-data": string[] }
  | { "output-data-kind": "exercises"; "output-data": string[] }
  | {
      "output-data-kind": "exercise-packaging-configuration"
      "output-data": ExercisePackagingConfiguration
    }
  | { "output-data-kind": "local-tmc-exercises"; "output-data": LocalTmcExercise[] }
  | { "output-data-kind": "local-mooc-exercises"; "output-data": LocalMoocExercise[] }
  | { "output-data-kind": "refresh-result"; "output-data": RefreshData }
  | { "output-data-kind": "test-result"; "output-data": RunResult }
  | { "output-data-kind": "exercise-desc"; "output-data": ExerciseDesc }
  | { "output-data-kind": "updated-exercises"; "output-data": UpdatedExercise[] }
  | {
      "output-data-kind": "tmc-exercise-download"
      "output-data": DownloadOrUpdateTmcCourseExercisesResult
    }
  | {
      "output-data-kind": "mooc-exercise-download"
      "output-data": DownloadOrUpdateMoocCourseExercisesResult
    }
  | { "output-data-kind": "combined-course-data"; "output-data": CombinedCourseData }
  | { "output-data-kind": "course-details"; "output-data": CourseDetails }
  | { "output-data-kind": "course-exercises"; "output-data": CourseExercise[] }
  | { "output-data-kind": "course-data"; "output-data": CourseData }
  | { "output-data-kind": "courses"; "output-data": Course[] }
  | { "output-data-kind": "exercise-details"; "output-data": ExerciseDetails }
  | { "output-data-kind": "submissions"; "output-data": Submission[] }
  | { "output-data-kind": "update-result"; "output-data": UpdateResult }
  | { "output-data-kind": "organization"; "output-data": Organization }
  | { "output-data-kind": "organizations"; "output-data": Organization[] }
  | { "output-data-kind": "reviews"; "output-data": Review[] }
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
  | { "output-data-kind": "mooc-course-instances"; "output-data": CourseInstance[] }
  | { "output-data-kind": "mooc-exercise-slides"; "output-data": TmcExerciseSlide[] }
  | { "output-data-kind": "mooc-exercise-slide"; "output-data": TmcExerciseSlide }
  | { "output-data-kind": "mooc-submission-finished"; "output-data": ExerciseTaskSubmissionResult }

export type Kind =
  | "generic"
  | "forbidden"
  | "not-logged-in"
  | "connection-error"
  | "obsolete-client"
  | "invalid-token"
  | {
      "failed-exercise-download": {
        completed: TmcExerciseDownload[]
        skipped: TmcExerciseDownload[]
        failed: [TmcExerciseDownload, string[]][]
      }
    }

export interface OutputData {
  status: Status
  message: string
  result: OutputResult
  data: DataKind | null
}

export type OutputResult =
  | "logged-in"
  | "logged-out"
  | "not-logged-in"
  | "error"
  | "executed-command"

export type Status = "finished" | "crashed"

export type StatusUpdateData =
  | ({ "update-data-kind": "client-update-data" } & StatusUpdate<ClientUpdateData>)
  | ({ "update-data-kind": "none" } & StatusUpdate<null>)

export interface Notification {
  "notification-kind": NotificationKind
  message: string
}

export type NotificationKind = "warning" | "info"

export interface StatusUpdate<T> {
  finished: boolean
  message: string
  "percent-done": number
  time: number
  data: T | null
}

export type ClientUpdateData =
  | { "client-update-data-kind": "exercise-download"; id: number; path: string }
  | ({ "client-update-data-kind": "posted-submission" } & NewSubmission)

export interface StyleValidationResult {
  strategy: StyleValidationStrategy
  validation_errors: Record<string, StyleValidationError[]> | null
}

export interface StyleValidationError {
  column: number
  line: number
  message: string
  source_name: string
}

export type StyleValidationStrategy = "FAIL" | "WARN" | "DISABLED"

export interface ExercisePackagingConfiguration {
  /**
   * Student folders or files which are copied from submission.
   */
  student_file_paths: string[]
  /**
   * Exercise folders or files which are copied from exercise template or clone.
   */
  exercise_file_paths: string[]
}

export type LocalExercise = { tmc: LocalTmcExercise } | { mooc: LocalMoocExercise }

export interface LocalTmcExercise {
  "exercise-slug": string
  "exercise-path": string
}

export interface LocalMoocExercise {
  "exercise-id": string
  "exercise-path": string
}

export type Compression = "tar" | "zip" | "zstd"

export interface RefreshData {
  "new-cache-path": string
  "course-options": object
  exercises: RefreshExercise[]
}

export interface RefreshExercise {
  name: string
  checksum: string
  points: string[]
  "sandbox-image": string
  "tmcproject-yml": TmcProjectYml | null
}

export interface TmcProjectYml {
  /**
   * A list of files or directories that will always be considered student files.
   */
  extra_student_files: string[]
  /**
   * A list of files or directories that will always be considered exercise files.
   * `extra_student_files` takes precedence if a file is both an extra student file and an extra exercise file.
   */
  extra_exercise_files: string[]
  /**
   * A list of files that should always be overwritten by updates even if they are student files.
   */
  force_update: string[]
  /**
   * If set, tests are forcibly stopped after this duration.
   */
  tests_timeout_ms?: number
  /**
   * If set, Valgrind errors will be considered test errors.
   */
  fail_on_valgrind_error?: boolean
  /**
   * If set, will cause an error telling the student to update their Python if their version is older than the minimum.
   */
  minimum_python_version?: PythonVer
  /**
   * Overrides the default sandbox image. e.g. `eu.gcr.io/moocfi-public/tmc-sandbox-python:latest`
   */
  sandbox_image?: string
}

export interface PythonVer {
  major: number
  minor: number | null
  patch: number | null
}

/** @see {isRunResult} ts-auto-guard:type-guard */
export interface RunResult {
  /**
   * The overall status of a test run.
   */
  status: RunStatus
  /**
   * Whether each test passed and which points were awarded.
   */
  testResults: TestResult[]
  /**
   * Logs from the test run.
   * The key may be an arbitrary string identifying the type of log.
   */
  logs: Record<string, string>
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
  /**
   * List of points that were received from the exercise from passed tests.
   */
  points: string[]
  message: string
  exception: string[]
}

export interface ExerciseDesc {
  /**
   * The name of the exercise to be shown to the user.
   * Does not necessarily match or even contain the directory name.
   */
  name: string
  /**
   * Descriptions of the tests that will be run for this exercise.
   */
  tests: TestDesc[]
}

export interface TestDesc {
  /**
   * The full name of the test.
   *
   * If the language organises tests into suites or classes, it is customary
   * to name the test as "class_name.method_name".
   */
  name: string
  /**
   * The list of point names that passing this test may give.
   *
   * To obtain a point X, the user must pass all exercises that require point X.
   */
  points: string[]
}

export interface UpdatedExercise {
  id: number
}

export interface DownloadOrUpdateTmcCourseExercisesResult {
  downloaded: TmcExerciseDownload[]
  skipped: TmcExerciseDownload[]
  failed?: [TmcExerciseDownload, Array<string>][]
}

export interface DownloadOrUpdateMoocCourseExercisesResult {
  downloaded: MoocExerciseDownload[]
  skipped: MoocExerciseDownload[]
  failed?: [MoocExerciseDownload, Array<string>][]
}

export interface TmcExerciseDownload {
  id: number
  "course-slug": string
  "exercise-slug": string
  path: string
}

export interface MoocExerciseDownload {
  id: string
  path: string
}

export interface CombinedCourseData {
  details: CourseDetails
  exercises: CourseExercise[]
  settings: CourseData
}

export interface CourseDetails {
  unlockables: string[]
  exercises: Exercise[]
  id: number
  name: string
  title: string
  description: string | null
  /**
   * /api/v8/core/courses/{course_id}
   */
  details_url: string
  /**
   * /api/v8/core/courses/{course_id}/unlock
   */
  unlock_url: string
  /**
   * /api/v8/core/courses/{course_id}/reviews
   */
  reviews_url: string
  /**
   * Typically empty.
   */
  comet_url: string
  spyware_urls: string[]
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
  /**
   * /api/v8/core/exercises/{exercise_id}/submissions
   */
  return_url: string
  /**
   * /api/v8/core/exercises/{exercise_id}/download
   */
  zip_url: string
  returnable: boolean
  requires_review: boolean
  attempted: boolean
  completed: boolean
  reviewed: boolean
  all_review_points_given: boolean
  memory_limit: number | null
  runtime_params: string[]
  valgrind_strategy: string | null
  code_review_requests_enabled: boolean
  run_tests_locally_action_enabled: boolean
  /**
   * Typically null.
   */
  latest_submission_url: string | null
  latest_submission_id: number | null
  /**
   * /api/v8/core/exercises/{exercise_id}/solution/download
   */
  solution_zip_url: string | null
}

export interface Course {
  id: number
  name: string
  title: string
  description: string | null
  /**
   * /api/v8/core/courses/{course_id}
   */
  details_url: string
  /**
   * /api/v8/core/courses/{course_id}/unlock
   */
  unlock_url: string
  /**
   * /api/v8/core/courses/{course_id}/reviews
   */
  reviews_url: string
  /**
   * Typically empty.
   */
  comet_url: string
  spyware_urls: string[]
}

export interface CourseExercise {
  id: number
  available_points: ExercisePoint[]
  awarded_points: string[]
  name: string
  publish_time: string | null
  solution_visible_after: string | null
  deadline: string | null
  soft_deadline: string | null
  disabled: boolean
  unlocked: boolean
}

export interface ExercisePoint {
  id: number
  exercise_id: number
  name: string
  requires_review: boolean
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
  /**
   * Typically empty.
   */
  material_url: string | null
  course_template_id: number | null
  hide_submission_results: boolean
  /**
   * Typically empty.
   */
  external_scoreboard_url: string | null
  organization_slug: string | null
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
  submissions: ExerciseSubmission[]
}

export interface ExerciseSubmission {
  exercise_name: string
  id: number
  user_id: number
  course_id: number
  created_at: string
  all_tests_passed: boolean
  points: string | null
  /**
   * /api/v8/core/submissions/{submission_id}/download
   */
  submitted_zip_url: string
  /**
   * https://tmc.mooc.fi/paste/{paste_code}
   */
  paste_url: string | null
  processing_time: number | null
  reviewed: boolean
  requests_review: boolean
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
  created: Exercise[]
  updated: Exercise[]
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
  points: string[]
  points_not_awarded: string[]
  /**
   * https://tmc.mooc.fi/submissions/{submission_id}/reviews
   */
  url: string
  /**
   * /api/v8/core/courses/{course_id}/reviews/{review_id}
   */
  update_url: string
  created_at: string
  updated_at: string
}

export interface NewSubmission {
  /**
   * https://tmc.mooc.fi/api/v8/core/submissions/{submission_id}
   */
  show_submission_url: string
  /**
   * https://tmc.mooc.fi/paste/{paste_code}
   */
  paste_url: string
  /**
   * https://tmc.mooc.fi/submissions/{submission_id}
   */
  submission_url: string
}

export interface SubmissionFeedbackResponse {
  api_version: number
  status: SubmissionStatus
}

export type SubmissionStatus = "processing" | "fail" | "ok" | "error" | "hidden"

export interface TmcStyleValidationResult {
  strategy: TmcStyleValidationStrategy
  validationErrors: Record<string, TmcStyleValidationError[]> | null
}

export interface TmcStyleValidationError {
  column: number
  line: number
  message: string
  sourceName: string
}

export type TmcStyleValidationStrategy = "FAIL" | "WARN" | "DISABLED"

export interface SubmissionFinished {
  api_version: number
  all_tests_passed: boolean | null
  user_id: number
  login: string
  course: string
  exercise_name: string
  status: SubmissionStatus
  points: string[]
  valgrind: string | null
  /**
   * https://tmc.mooc.fi/submissions/{submission_id}}
   */
  submission_url: string
  /**
   * https://tmc.mooc.fi/exercises/{exercise_id}/solution
   */
  solution_url: string | null
  submitted_at: string
  processing_time: number | null
  reviewed: boolean
  requests_review: boolean
  /**
   * https://tmc.mooc.fi/paste/{paste_code}
   */
  paste_url: string | null
  message_for_paste: string | null
  missing_review_points: string[]
  test_cases: TestCase[] | null
  feedback_questions: SubmissionFeedbackQuestion[] | null
  /**
   * /api/v8/core/submissions/{submission_id}/feedback
   */
  feedback_answer_url: string | null
  error: string | null
  validations: TmcStyleValidationResult | null
}

export interface TestCase {
  name: string
  successful: boolean
  message: string | null
  exception: string[] | null
  detailed_message: string | null
}

export interface SubmissionFeedbackQuestion {
  id: number
  question: string
  kind: SubmissionFeedbackKind
}

export type SubmissionFeedbackKind = "Text" | { IntRange: { lower: number; upper: number } }

export type ConfigValue = unknown | null | string

export interface TmcConfig {
  projects_dir: string
}

export interface CourseInstance {
  id: string
  course_id: string
  course_slug: string
  course_name: string
  course_description: string | null
  instance_name: string | null
  instance_description: string | null
}

export interface TmcExerciseSlide {
  slide_id: string
  exercise_id: string
  exercise_name: string
  exercise_order_number: number
  deadline: string | null
  tasks: TmcExerciseTask[]
}

export interface TmcExerciseTask {
  task_id: string
  order_number: number
  assignment: unknown
  public_spec: PublicSpec | null
  model_solution_spec: ModelSolutionSpec | null
}

export type PublicSpec =
  | { type: "Browser"; files: ExerciseFile[] }
  | { type: "Editor"; archive_name: string; archive_download_url: string; checksum: string }

export type ModelSolutionSpec =
  | { type: "Browser"; solution_files: ExerciseFile[] }
  | { type: "Editor"; download_url: string }

export interface ExerciseFile {
  filepath: string
  contents: string
}

export interface ExerciseTaskSubmissionResult {
  submission_id: string
}
