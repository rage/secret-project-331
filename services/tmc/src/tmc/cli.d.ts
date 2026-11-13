// VERSION=0.41.1
// https://raw.githubusercontent.com/rage/tmc-langs-rust/0.41.1/crates/tmc-langs-cli/bindings.d.ts

export type Locale = string

/** @see {isCliOutput} ts-auto-guard:type-guard */
export type CliOutput =
  | ({ "output-kind": "output-data" } & OutputData)
  | ({ "output-kind": "status-update" } & StatusUpdateData)
  | ({ "output-kind": "notification" } & Notification)

export type DataKind =
  | {
      "output-data-kind": "error"
      "output-data": {
        kind: Kind
        trace: Array<string>
        /**
         * The HTTP status a server answered with, when the error is one.
         */
        http_status?: number
      }
    }
  | { "output-data-kind": "validation"; "output-data": StyleValidationResult | null }
  | { "output-data-kind": "available-points"; "output-data": Array<string> }
  | { "output-data-kind": "exercises"; "output-data": Array<string> }
  | {
      "output-data-kind": "exercise-packaging-configuration"
      "output-data": ExercisePackagingConfiguration
    }
  | { "output-data-kind": "refresh-result"; "output-data": RefreshData }
  | { "output-data-kind": "test-result"; "output-data": RunResult }
  | { "output-data-kind": "exercise-desc"; "output-data": ExerciseDesc }
  | { "output-data-kind": "updated-exercises"; "output-data": Array<UpdatedExercise> }
  | {
      "output-data-kind": "mooc-exercise-download"
      "output-data": DownloadOrUpdateMoocCourseExercisesResult
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
  | { "output-data-kind": "compressed-project-hash"; "output-data": string }
  | { "output-data-kind": "submission-sandbox"; "output-data": string }
  | { "output-data-kind": "local-exercises"; "output-data": Array<LocalExercise> }
  | { "output-data-kind": "local-tmc-exercises"; "output-data": Array<LocalTmcExercise> }
  | {
      "output-data-kind": "tmc-exercise-download"
      "output-data": DownloadOrUpdateTmcCourseExercisesResult
    }
  | { "output-data-kind": "tmc-config"; "output-data": TmcConfig }
  | { "output-data-kind": "mooc-updated-exercises"; "output-data": Array<MoocUpdatedExercise> }
  | { "output-data-kind": "local-mooc-exercises"; "output-data": Array<LocalMoocExercise> }
  | { "output-data-kind": "mooc-course"; "output-data": MoocCourse }
  | { "output-data-kind": "mooc-courses"; "output-data": Array<MoocCourse> }
  | { "output-data-kind": "mooc-exercise-slides"; "output-data": Array<TmcExerciseSlide> }
  | { "output-data-kind": "mooc-exercise-slide"; "output-data": TmcExerciseSlide }
  | { "output-data-kind": "mooc-submission-finished"; "output-data": ExerciseTaskSubmissionResult }
  | { "output-data-kind": "mooc-submission-status"; "output-data": ExerciseTaskSubmissionStatus }
  | {
      "output-data-kind": "mooc-submissions"
      "output-data": Array<ExerciseSlideSubmissionListItem>
    }
  | { "output-data-kind": "mooc-paste"; "output-data": PasteResult }
  | { "output-data-kind": "mooc-course-progress"; "output-data": CourseProgress }
  | { "output-data-kind": "mooc-combined-course-data"; "output-data": CombinedMoocCourseData }
  | { "output-data-kind": "mooc-old-submission-restore"; "output-data": MoocOldSubmissionRestore }

export type Kind =
  | "generic"
  | "forbidden"
  | "not-logged-in"
  | "connection-error"
  | "obsolete-client"
  | "invalid-token"
  | "not-enrolled"
  | "upload-expired"
  | "unknown-upload"
  | "device-login-denied"
  | "device-login-expired"
  | "not-found"
  | "server-error"
  | "insufficient-scope"
  | "exercise-not-found"

export type OutputData = {
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
  | ({ "update-data-kind": "mooc-client-update-data" } & StatusUpdate<MoocClientUpdateData>)
  | ({ "update-data-kind": "mooc-device-login" } & StatusUpdate<MoocDeviceLogin>)
  | ({ "update-data-kind": "none" } & StatusUpdate<null>)

export type MoocDeviceLogin = {
  /**
   * URL the user opens to enter the `user_code`.
   */
  verification_uri: string
  /**
   * URL that already includes the `user_code`, if the server provided one.
   */
  verification_uri_complete: string | null
  /**
   * The code the user enters (or confirms) on the verification page.
   */
  user_code: string
  /**
   * Seconds until the device/user codes expire.
   */
  expires_in: number
  /**
   * Minimum seconds between token-endpoint polls.
   */
  interval: number
}

export type Notification = { "notification-kind": NotificationKind; message: string }

export type NotificationKind = "warning" | "info"

export type StatusUpdate<T> = {
  finished: boolean
  message: string
  "percent-done": number
  time: number
  data: T | null
}

export type ClientUpdateData =
  | { "client-update-data-kind": "exercise-download"; id: number; path: string }
  | ({ "client-update-data-kind": "posted-submission" } & NewSubmission)

export type StyleValidationResult = {
  strategy: StyleValidationStrategy
  validation_errors: Record<string, Array<StyleValidationError>> | null
}

export type StyleValidationError = {
  column: number
  line: number
  message: string
  source_name: string
}

export type StyleValidationStrategy = "FAIL" | "WARN" | "DISABLED"

export type ExercisePackagingConfiguration = {
  /**
   * Student folders or files which are copied from submission.
   */
  student_file_paths: Array<string>
  /**
   * Exercise folders or files which are copied from exercise template or clone.
   */
  exercise_file_paths: Array<string>
}

export type LocalExercise =
  | ({ backend: "tmc" } & LocalTmcExercise)
  | ({ backend: "mooc" } & LocalMoocExercise)

export type LocalTmcExercise = {
  /**
   * The course's on-disk directory name, which is also its TMC slug.
   */
  "course-slug": string
  /**
   * `None` for a course downloaded before course ids were recorded.
   */
  "course-id": number | null
  "exercise-slug": string
  "exercise-id": number
  "exercise-path": string
}

export type LocalMoocExercise = {
  /**
   * The course's on-disk directory name. Mooc courses have no server-side
   * slug; this is the kebab-cased course name, deduplicated locally.
   */
  "course-slug": string
  "course-id": string
  /**
   * The exercise's on-disk directory name, used as its slug (mirrors the TMC
   * slug); stable since names are unique per course.
   */
  "exercise-slug": string
  "exercise-id": string
  "exercise-path": string
}

export type Compression = "tar" | "zip" | "zstd"

export type RefreshData = {
  "new-cache-path": string
  "course-options": object
  exercises: Array<RefreshExercise>
}

export type RefreshExercise = {
  name: string
  checksum: string
  points: Array<string>
  "sandbox-image": string
  "tmcproject-yml": TmcProjectYml | null
}

export type TmcProjectYml = {
  /**
   * A list of files or directories that will always be considered student files.
   */
  extra_student_files: Array<string>
  /**
   * A list of files or directories that will always be considered exercise files.
   * `extra_student_files` takes precedence if a file is both an extra student file and an extra exercise file.
   */
  extra_exercise_files: Array<string>
  /**
   * A list of files that should always be overwritten by updates even if they are student files.
   */
  force_update: Array<string>
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
  /**
   * Overrides the default archive size limit (500 Mb).
   */
  submission_size_limit_mb?: number
}

export type PythonVer = { major: number; minor: number | null; patch: number | null }

/** @see {isRunResult} ts-auto-guard:type-guard */
export type RunResult = {
  /**
   * The overall status of a test run.
   */
  status: RunStatus
  /**
   * Whether each test passed and which points were awarded.
   */
  testResults: Array<TestResult>
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

export type TestResult = {
  name: string
  successful: boolean
  /**
   * List of points that were received from the exercise from passed tests.
   */
  points: Array<string>
  message: string
  exception: Array<string>
}

export type ExerciseDesc = {
  /**
   * The name of the exercise to be shown to the user.
   * Does not necessarily match or even contain the directory name.
   */
  name: string
  /**
   * Descriptions of the tests that will be run for this exercise.
   */
  tests: Array<TestDesc>
}

export type TestDesc = {
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
  points: Array<string>
}

export type UpdatedExercise = { id: number }

export type MoocUpdatedExercise = { id: string }

export type DownloadOrUpdateTmcCourseExercisesResult = {
  downloaded: Array<TmcExerciseDownload>
  skipped: Array<TmcExerciseDownload>
  failed?: Array<[TmcExerciseDownload, Array<string>]>
}

export type DownloadOrUpdateMoocCourseExercisesResult = {
  downloaded: Array<MoocExerciseDownload>
  skipped: Array<MoocExerciseDownload>
  failed?: Array<[MoocExerciseDownload, Array<string>]>
}

export type TmcExerciseDownload = {
  id: number
  "course-slug": string
  "exercise-slug": string
  path: string
}

export type MoocExerciseDownload = {
  /**
   * The requested exercise's id (not the internal editor task id), so callers
   * can match each download/skip/failure to the exercise.
   */
  "exercise-id": string
  path: string
}

export type CombinedCourseData = {
  details: CourseDetails
  exercises: Array<CourseExercise>
  settings: CourseData
}

export type CourseDetails = {
  unlockables: Array<string>
  exercises: Array<Exercise>
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
  spyware_urls: Array<string>
}

export type Exercise = {
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
  runtime_params: Array<string>
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

export type Course = {
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
  spyware_urls: Array<string>
}

export type CourseExercise = {
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

export type ExercisePoint = {
  id: number
  exercise_id: number
  name: string
  requires_review: boolean
}

export type CourseData = {
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

export type ExerciseDetails = {
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

export type ExerciseSubmission = {
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

export type Submission = {
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

export type UpdateResult = { created: Array<Exercise>; updated: Array<Exercise> }

export type Organization = {
  name: string
  information: string
  slug: string
  logo_path: string
  pinned: boolean
}

export type Review = {
  submission_id: number
  exercise_name: string
  id: number
  marked_as_read: boolean
  reviewer_name: string
  review_body: string
  points: Array<string>
  points_not_awarded: Array<string>
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

export type NewSubmission = {
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

export type SubmissionFeedbackResponse = { api_version: number; status: SubmissionStatus }

export type SubmissionStatus = "processing" | "fail" | "ok" | "error" | "hidden"

export type TmcStyleValidationResult = {
  strategy: TmcStyleValidationStrategy
  validationErrors: Record<string, Array<TmcStyleValidationError>> | null
}

export type TmcStyleValidationError = {
  column: number
  line: number
  message: string
  sourceName: string
}

export type TmcStyleValidationStrategy = "FAIL" | "WARN" | "DISABLED"

export type SubmissionFinished = {
  api_version: number
  all_tests_passed: boolean | null
  user_id: number
  login: string
  course: string
  exercise_name: string
  status: SubmissionStatus
  points: Array<string>
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
  missing_review_points: Array<string>
  test_cases: Array<TestCase> | null
  feedback_questions: Array<SubmissionFeedbackQuestion> | null
  /**
   * /api/v8/core/submissions/{submission_id}/feedback
   */
  feedback_answer_url: string | null
  error: string | null
  validations: TmcStyleValidationResult | null
}

export type TestCase = {
  name: string
  successful: boolean
  message: string | null
  exception: Array<string> | null
  detailed_message: string | null
}

export type SubmissionFeedbackQuestion = {
  id: number
  question: string
  kind: SubmissionFeedbackKind
}

export type SubmissionFeedbackKind = "Text" | { IntRange: { lower: number; upper: number } }

export type ConfigValue = unknown | null | string

export type TmcConfig = { projects_dir: string }

export type MoocCourse = {
  id: string
  slug: string
  name: string
  description: string | null
  organization_name: string
  /**
   * `not_set` from a host that predates the field.
   */
  ai_policy: CourseAiPolicy
}

export type CourseAiPolicy =
  | "not_set"
  | "no_ai"
  | "planning_only"
  | "limited"
  | "full_use"
  | "required"
  | "unrecognized"

export type TmcExerciseSlide = {
  slide_id: string
  exercise_id: string
  /**
   * Lets a client locate the exercise's course without a separate lookup.
   */
  course_id: string
  exercise_name: string
  exercise_order_number: number
  deadline: string | null
  tasks: Array<TmcExerciseTask>
  /**
   * The course material page the exercise is on, which also shows the student's latest
   * submission. `None` from a host that does not report it.
   */
  page_url: string | null
  /**
   * `None` for an exercise outside any chapter, or from a host that does not report it.
   */
  chapter: ExerciseChapter | null
}

export type ExerciseChapter = {
  id: string
  name: string
  /**
   * The chapter's position in the course, from 1.
   */
  chapter_number: number
}

export type TmcExerciseTask = {
  task_id: string
  order_number: number
  assignment: unknown
  public_spec: PublicSpec | null
  model_solution_spec: ModelSolutionSpec | null
  checksum: string | null
}

export type PublicSpec = {
  type: ExerciseType
  archive_name: string
  stub_download_url: string
  student_file_paths: Array<string>
  checksum: string
  /**
   * In-browser test config; omitted for editor exercises or when no script
   * was built.
   */
  browser_test: BrowserTestSpec | null
}

export type ExerciseType = "browser" | "editor"

export type BrowserTestSpec = { runtime: BrowserTestRuntime; script: string; error: string | null }

export type BrowserTestRuntime = "python"

export type ModelSolutionSpec = { type: ExerciseType; solution_download_url: string }

export type ExerciseTaskSubmissionResult = {
  /**
   * Identifies the task submission; what grading is polled for.
   */
  task_submission_id: string
  /**
   * Identifies the slide submission; what downloading and sharing take.
   */
  slide_submission_id: string
  /**
   * The exercise's course material page, where the submission's grading also shows. Set by
   * [`MoocClient::submit_exercise`], which has the exercise at hand; `None` otherwise, or when
   * the host reports no page.
   */
  exercise_page_url: string | null
}

export type ExerciseTaskSubmissionStatus =
  | { status: "no-grading-yet" }
  | { status: "grading"; grading: Grading }

export type Grading = {
  grading_progress: GradingProgress
  /**
   * Absent until grading has produced a value; a partial value while
   * `grading_progress` is still pending.
   */
  score_given: number | null
  grading_started_at: string | null
  grading_completed_at: string | null
  /**
   * Human-readable feedback, for a client to display as-is.
   */
  feedback_text: string | null
  /**
   * The user's progress on the whole exercise as of this poll; its `completed` is the
   * authoritative "passed" signal. `None` for an exam exercise or from a host that does not
   * report it.
   */
  exercise_progress: ExerciseProgress | null
}

export type GradingProgress = "Failed" | "NotReady" | "PendingManual" | "Pending" | "FullyGraded"

export type ExerciseSlideSubmissionListItem = {
  id: string
  exercise_id: string
  created_at: string
  score_given: number | null
  grading_progress: GradingProgress | null
}

export type PasteResult = { paste_url: string }

export type CourseProgress = { course_id: string; exercises: Array<ExerciseProgress> }

export type ExerciseProgress = {
  exercise_id: string
  /**
   * Points awarded to the user; `0.0` when the user has no state for the
   * exercise. Can be fractional (partial credit).
   */
  score_given: number
  /**
   * The maximum points obtainable from the exercise; can be `0`.
   */
  score_maximum: number
  /**
   * `true` once the exercise reached the `Completed` activity stage.
   */
  completed: boolean
  /**
   * `true` once the user has started or submitted the exercise.
   */
  attempted: boolean
  /**
   * `None` from a host that predates the field.
   */
  standing: ExerciseStanding | null
}

export type ExerciseStanding = "NotAttempted" | "Attempted" | "Passed" | "OutOfTries"

export type MoocClientUpdateData = {
  "client-update-data-kind": "exercise-download"
  id: string
  path: string
}

export type MoocOldSubmissionRestore = "restored" | "nothing-to-download"

export type CombinedMoocCourseData = {
  course: MoocCourse
  slides: Array<TmcExerciseSlide>
  progress: CourseProgress
}
