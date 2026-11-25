// VERSION=0.43.1
// https://raw.githubusercontent.com/rage/tmc-langs-rust/0.43.1/crates/tmc-langs-cli/bindings.d.ts

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
        /**
         * The id courses.mooc.fi logged the failed request under, for support.
         */
        request_id?: string
        /**
         * How long the server asked to wait before trying again, in seconds.
         */
        retry_after_secs?: number
        /**
         * The file or folder a file-system error concerns.
         */
        path?: string
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
  | { "output-data-kind": "repository-exercises"; "output-data": Array<RepositoryExercise> }
  | { "output-data-kind": "test-result"; "output-data": RunResult }
  | { "output-data-kind": "exercise-desc"; "output-data": ExerciseDesc }
  | { "output-data-kind": "exercise-updates"; "output-data": ExerciseUpdates }
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
  | { "output-data-kind": "mooc-exercise-updates"; "output-data": MoocExerciseUpdates }
  | { "output-data-kind": "local-mooc-exercises"; "output-data": Array<LocalMoocExercise> }
  | { "output-data-kind": "mooc-current-user"; "output-data": MoocCurrentUser }
  | { "output-data-kind": "mooc-course"; "output-data": MoocCourse }
  | { "output-data-kind": "mooc-courses"; "output-data": Array<MoocCourse> }
  | { "output-data-kind": "mooc-exams"; "output-data": Array<MoocExam> }
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
  | "rate-limited"
  | "deadline-passed"
  | "out-of-tries"
  | "chapter-not-open-yet"
  | "chapter-not-unlocked-yet"
  | "chapter-completed-and-locked"
  | "exercise-locked"
  | "invalid-request"
  | "unexpected-response"
  | "connection-timeout"
  | "certificate-error"
  | "proxy-error"
  | "login-client-rejected"
  | "tmc-login-not-accepted"
  | "tmc-login-unconfirmed"
  | "local-config-corrupt"
  | "archive-too-large"
  | "unsupported-exercise"
  | "file-in-use"
  | "permission-denied"
  | "path-too-long"
  | "disk-full"
  | "toolchain-missing"
  | "executable-blocked"
  | "projects-dir-unreachable"
  | "projects-dir-move-to-itself"
  | "projects-dir-move-into-itself"
  | "projects-restore-conflict"
  | "projects-split"

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

/** @see {isStyleValidationResult} ts-auto-guard:type-guard */
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
  /**
   * How long the exercise's tests may run: its `.tmcproject.yml`'s `tests_timeout_ms`, else
   * [`DEFAULT_TESTS_TIMEOUT`]. Absent only from CLIs older than this field.
   */
  tests_timeout_ms?: number
  /**
   * The language plugin that recognised the exercise: `python3`, `apache-maven`,
   * `apache-ant`, `csharp`, `make`, `r` or `No-Tests`. Absent only from CLIs older than this
   * field.
   */
  plugin?: string
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
   * The course's on-disk directory name, derived from the course name and unique among the
   * local courses. Not the course's server-side `slug`.
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

export type RepositoryExercise = {
  /**
   * The exercise directory.
   */
  path: string
  /**
   * The directories between the repository root and the exercise directory, joined with `-`.
   * Together with `name`, the name `refresh-course` gives the exercise.
   */
  part: string
  /**
   * The exercise directory's name.
   */
  name: string
  /**
   * The language plugin that recognised the exercise, as `get-exercise-packaging-configuration`
   * names it.
   */
  plugin: string
  /**
   * How long the exercise's tests may run, with the repository's root config merged in.
   */
  tests_timeout_ms: number
  /**
   * The files this command wrote into the exercise directory, relative to it.
   */
  written_files: Array<string>
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
  /**
   * Set when the tests were stopped for running longer than this many milliseconds: the
   * exercise's `tests_timeout_ms`, else 60000. The status is then `TESTS_FAILED`, with one
   * failing test named "Timeout test" whose message says so; an infinite loop is the usual
   * cause.
   */
  timedOutAfterMs?: number
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

export type ExerciseUpdates = {
  /**
   * Exercises whose server version differs from the local copy.
   */
  updated: Array<number>
  /**
   * Exercises the server no longer has. Their local copies are left in place and are never updated.
   */
  removed: Array<number>
}

export type MoocExerciseUpdates = {
  /**
   * Exercises whose server version differs from the local copy.
   */
  updated: Array<string>
  /**
   * Exercises their course no longer has. Their local copies are left in place and are never updated.
   * Exercises of a chapter that has not opened yet are absent from the course but not removed.
   */
  removed: Array<string>
  /**
   * Courses on disk that courses.mooc.fi refused to serve. `updated` and `removed` say nothing
   * about their exercises.
   */
  unchecked_courses: Array<UncheckedMoocCourse>
}

export type UncheckedMoocCourse = { course_id: string; kind: CourseRefusalKind }

export type CourseRefusalKind = "insufficient-scope" | "forbidden" | "not-found"

export type DownloadOrUpdateTmcCourseExercisesResult = {
  downloaded: Array<TmcExerciseDownload>
  skipped: Array<TmcExerciseDownload>
  /**
   * Each failure with its error chain, outermost first, and why it failed.
   */
  failed?: Array<[TmcExerciseDownload, Array<string>, TmcDownloadFailure]>
}

export type DownloadOrUpdateMoocCourseExercisesResult = {
  downloaded: Array<MoocExerciseDownload>
  skipped: Array<MoocExerciseDownload>
  /**
   * Each failure with its error chain, outermost first, and why it failed.
   */
  failed?: Array<[MoocExerciseDownload, Array<string>, MoocDownloadFailure]>
  /**
   * The chapter of each `failed` entry whose failure is `closed-chapter`.
   */
  closed_chapters: Array<MoocExerciseClosedChapter>
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

export type MoocExerciseClosedChapter = {
  "exercise-id": string
  "chapter-name": string
  /**
   * The chapter's position in the course, from 1.
   */
  "chapter-number": number
  "opens-at": string
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

export type MoocCurrentUser = {
  id: string
  /**
   * For showing which account is logged in. `None` when the user gave none, and from a host
   * that predates the field.
   */
  name: string | null
  /**
   * `None` from a host that predates the field.
   */
  email: string | null
}

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
  /**
   * The course material's front page. `None` from a host that predates the field.
   */
  url: string | null
  /**
   * IETF BCP 47 tag such as `fi-FI`. `None` from a host that predates the field.
   */
  language_code: string | null
  /**
   * Shared by every language version of the course; each version is a separate course with
   * its own exercises.
   */
  language_group_id: string | null
  /**
   * The language version the user moved to from this course, if they did.
   */
  moved_to_course_id: string | null
  /**
   * When the course run ends or ended; it takes no new students from then on.
   */
  closed_at: string | null
  /**
   * The course that continues this one after it closed, if its teacher named one.
   */
  successor_course_id: string | null
  /**
   * `Some(false)` for a course the user only teaches: submits to it fail with the
   * `not-enrolled` error kind. `None` from a host that predates the field.
   */
  is_enrolled: boolean | null
  /**
   * Staff get exercises of unopened chapters and model solutions whatever their progress.
   */
  is_staff: boolean
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
   * Lets a client locate the exercise's course without a separate lookup. The nil UUID for an
   * exam exercise, which `exam_id` names instead.
   */
  course_id: string
  /**
   * `None` for a course exercise.
   */
  exam_id: string | null
  exercise_name: string
  exercise_order_number: number
  /**
   * The effective deadline: the exercise's own, else its chapter's. Submissions are refused
   * from this moment on.
   */
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
  /**
   * Why the exercise cannot be downloaded to work on in an editor: `browser-only` or
   * `several-editor-tasks`, the failure `download-or-update-course-exercises` would report.
   * Absent when it can be downloaded, and from CLIs older than this field.
   */
  unsupported?: MoocDownloadFailure
}

export type ExerciseChapter = {
  id: string
  name: string
  /**
   * The chapter's position in the course, from 1.
   */
  chapter_number: number
  /**
   * The user's status in the course's chapter locking; submissions are refused unless it is
   * `Unlocked`. `None` when the course does not lock chapters, or the host does not report it.
   */
  locking_status: ChapterLockingStatus | null
}

export type ChapterLockingStatus = "Unlocked" | "CompletedAndLocked" | "NotUnlockedYet"

export type TmcExerciseTask = {
  task_id: string
  order_number: number
  assignment: unknown
  /**
   * The plain text of `assignment`, one entry per block that has text, nested blocks after
   * their parent. Absent when it has none, and from CLIs older than this field.
   */
  instructions_text?: Array<string>
  public_spec: PublicSpec | null
  model_solution_spec: ModelSolutionSpec | null
  checksum: string | null
  /**
   * The exercise service that owns the task. Specs are read only for [`TMC_SERVICE_SLUG`];
   * any other service's task has neither spec.
   */
  exercise_service_slug: string
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
  | { status: "grading-hidden" }
  | { status: "unrecognized" }

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
  /**
   * The test run the grading was based on. `None` until grading has produced one, or when the
   * exercise service reported something else.
   */
  test_results: GradingTestRun | null
  /**
   * The exercise in the course material, where the latest submission and its grading show.
   * `None` for an exam exercise, and from a host that predates the field.
   */
  submission_page_url: string | null
}

export type GradingProgress =
  | "Failed"
  | "NotReady"
  | "PendingManual"
  | "Pending"
  | "FullyGraded"
  | "Unrecognized"

export type GradingTestRun = {
  status: GradingTestRunStatus
  /**
   * Empty when the tests did not run, e.g. on a compile failure.
   */
  test_results: Array<GradingTestResult>
  /**
   * The run's output keyed by log type (e.g. `stdout`, `stderr`). Empty unless `status` is
   * `COMPILE_FAILED` or `GENERIC_ERROR`, where it holds the compiler or error output.
   */
  logs: Record<string, string>
}

export type GradingTestRunStatus =
  | "PASSED"
  | "TESTS_FAILED"
  | "COMPILE_FAILED"
  | "TESTRUN_INTERRUPTED"
  | "GENERIC_ERROR"

export type GradingTestResult = {
  name: string
  successful: boolean
  /**
   * The points the test earned; empty when it failed.
   */
  points: Array<string>
  message: string
  /**
   * Stack trace lines of a failure.
   */
  exception: Array<string>
}

export type ExerciseSlideSubmissionListItem = {
  id: string
  exercise_id: string
  created_at: string
  /**
   * Always `None` for a snapshot.
   */
  score_given: number | null
  /**
   * Always `None` for a snapshot.
   */
  grading_progress: GradingProgress | null
  /**
   * `submission` from a host that predates the field, which lists only submissions.
   */
  kind: SubmissionKind
  /**
   * Whether the entry has a live share link, whatever its kind. `false` from a host that
   * predates the field.
   */
  is_shared: boolean
}

export type SubmissionKind = "submission" | "paste" | "backup" | "unrecognized"

export type PasteResult = { paste_url: string }

export type CourseProgress = {
  course_id: string
  exercises: Array<ExerciseProgress>
  /**
   * Chapters that have not opened yet. Their exercises are missing from `exercises` and
   * from the course's exercise list until then; they are closed, not removed.
   */
  closed_chapters: Array<ClosedChapter>
}

export type ClosedChapter = {
  id: string
  name: string
  /**
   * The chapter's position in the course, from 1.
   */
  chapter_number: number
  opens_at: string
  exercises: Array<ExerciseProgress>
}

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
  /**
   * How many graded submissions the exercise accepts per slide; `None` when unlimited.
   */
  max_tries: number | null
  /**
   * How many of `max_tries` are left on the slide the user answers; `None` when unlimited.
   */
  tries_left: number | null
  /**
   * What the user's points wait for when a teacher must review their answer first. While set,
   * `score_given` is `0.0` and `standing` is `Attempted`, even after a fully passing grading.
   */
  pending_teacher_review: PendingTeacherReview | null
  /**
   * `true` once the exercise takes no more submissions from the user, whatever its chapter's
   * locking status says. A submit fails with the `chapter-completed-and-locked` error kind
   * while the chapter is locked for the user, and with `exercise-locked` otherwise.
   */
  exercise_locked: boolean
  /**
   * Where the answer is in the exercise's peer, self or teacher review, which happens in the
   * course material. `None` while the user can still answer, and from a host that predates
   * the field.
   */
  reviewing_stage: ReviewingStage | null
  /**
   * A teacher's grading that overrides the automatic score. `None` when there is none to show.
   */
  teacher_review: TeacherReview | null
}

export type ExerciseStanding =
  | "NotAttempted"
  | "Attempted"
  | "Passed"
  | "OutOfTries"
  | "Unrecognized"

export type PendingTeacherReview = "awaits_chapter_lock" | "awaits_teacher" | "unrecognized"

export type ReviewingStage =
  | "peer_review"
  | "self_review"
  | "waiting_for_peer_reviews"
  | "waiting_for_teacher"
  | "reviewed_and_locked"
  | "locked"
  | "not_answered_and_locked"
  | "unrecognized"

export type TeacherReview = {
  decision: TeacherDecision
  /**
   * Replaces the automatic score.
   */
  score_given: number
  justification: string | null
  created_at: string
}

export type TeacherDecision =
  | "zero_points"
  | "custom_points"
  | "suspected_plagiarism"
  | "reject_and_reset"
  | "unauthorized_ai_use"
  | "bad_answer"
  | "other"
  | "unrecognized"

export type MoocExam = {
  id: string
  name: string
  started_at: string
  /**
   * Answers are accepted until then: the end of the user's time or of the exam, whichever
   * comes first.
   */
  answerable_until: string
}

export type MoocClientUpdateData = {
  "client-update-data-kind": "exercise-download"
  id: string
  path: string
}

export type MoocOldSubmissionRestore = "restored" | "nothing-to-download"

export type MoocDownloadFailure =
  | "not-found"
  | "closed-chapter"
  | "browser-only"
  | "several-editor-tasks"
  | "file-missing"
  | "server-error"
  | "connection-error"
  | "extract-failed"
  | "other"

export type TmcDownloadFailure =
  | "not-found"
  | "server-error"
  | "connection-error"
  | "extract-failed"
  | "other"

export type CombinedMoocCourseData = {
  course: MoocCourse
  slides: Array<TmcExerciseSlide>
  progress: CourseProgress
}
