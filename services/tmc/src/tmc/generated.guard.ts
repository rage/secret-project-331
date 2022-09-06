/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

/*
 * Generated type guards for "generated.d.ts".
 * WARNING: Do not manually change this file.
 */
import {
  CombinedCourseData,
  Compression,
  CourseData,
  CourseDetails,
  CourseExercise,
  DownloadOrUpdateCourseExercisesResult,
  Exercise,
  ExerciseDesc,
  ExerciseDetails,
  ExerciseDownload,
  ExercisePackagingConfiguration,
  ExercisePoint,
  ExerciseSubmission,
  LocalExercise,
  NewSubmission,
  Organization,
  PythonVer,
  RefreshData,
  RefreshExercise,
  Review,
  RunResult,
  RunStatus,
  StyleValidationError,
  StyleValidationResult,
  StyleValidationStrategy,
  Submission,
  SubmissionFeedbackKind,
  SubmissionFeedbackQuestion,
  SubmissionFeedbackResponse,
  SubmissionFinished,
  SubmissionStatus,
  TestCase,
  TestDesc,
  TestResult,
  TmcConfig,
  TmcProjectYml,
  UpdatedExercise,
  UpdateResult,
} from "./generated"

export function isStyleValidationResult(
  obj: any,
  _argumentName?: string,
): obj is StyleValidationResult {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (isStyleValidationStrategy(obj.strategy) as boolean) &&
    (obj.validationErrors === null ||
      (((obj.validationErrors !== null && typeof obj.validationErrors === "object") ||
        typeof obj.validationErrors === "function") &&
        Object.entries<any>(obj.validationErrors).every(
          ([key, value]) =>
            Array.isArray(value) &&
            value.every((e: any) => isStyleValidationError(e) as boolean) &&
            typeof key === "string",
        )))
  )
}

export function isStyleValidationError(
  obj: any,
  _argumentName?: string,
): obj is StyleValidationError {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.column === "number" &&
    typeof obj.line === "number" &&
    typeof obj.message === "string" &&
    typeof obj.sourceName === "string"
  )
}

export function isStyleValidationStrategy(
  obj: any,
  _argumentName?: string,
): obj is StyleValidationStrategy {
  return obj === "FAIL" || obj === "WARN" || obj === "DISABLED"
}

export function isExercisePackagingConfiguration(
  obj: any,
  _argumentName?: string,
): obj is ExercisePackagingConfiguration {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    Array.isArray(obj.student_file_paths) &&
    obj.student_file_paths.every((e: any) => typeof e === "string") &&
    Array.isArray(obj.exercise_file_paths) &&
    obj.exercise_file_paths.every((e: any) => typeof e === "string")
  )
}

export function isLocalExercise(obj: any, _argumentName?: string): obj is LocalExercise {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.exercise_slug === "string" &&
    typeof obj.exercise_path === "string"
  )
}

export function isCompression(obj: any, _argumentName?: string): obj is Compression {
  return obj === "tar" || obj === "zip" || obj === "zstd"
}

export function isRefreshData(obj: any, _argumentName?: string): obj is RefreshData {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.new_cache_path === "string" &&
    typeof obj.course_options === "object" &&
    Array.isArray(obj.exercises) &&
    obj.exercises.every((e: any) => isRefreshExercise(e) as boolean)
  )
}

export function isRefreshExercise(obj: any, _argumentName?: string): obj is RefreshExercise {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.name === "string" &&
    typeof obj.checksum === "string" &&
    Array.isArray(obj.points) &&
    obj.points.every((e: any) => typeof e === "string") &&
    typeof obj.sandbox_image === "string" &&
    (obj.tmcproject_yml === null || (isTmcProjectYml(obj.tmcproject_yml) as boolean))
  )
}

export function isTmcProjectYml(obj: any, _argumentName?: string): obj is TmcProjectYml {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    Array.isArray(obj.extra_student_files) &&
    obj.extra_student_files.every((e: any) => typeof e === "string") &&
    Array.isArray(obj.extra_exercise_files) &&
    obj.extra_exercise_files.every((e: any) => typeof e === "string") &&
    Array.isArray(obj.force_update) &&
    obj.force_update.every((e: any) => typeof e === "string") &&
    (typeof obj.tests_timeout_ms === "undefined" || typeof obj.tests_timeout_ms === "bigint") &&
    (typeof obj.fail_on_valgrind_error === "undefined" ||
      obj.fail_on_valgrind_error === false ||
      obj.fail_on_valgrind_error === true) &&
    (typeof obj.minimum_python_version === "undefined" ||
      (isPythonVer(obj.minimum_python_version) as boolean)) &&
    (typeof obj.sandbox_image === "undefined" || typeof obj.sandbox_image === "string")
  )
}

export function isPythonVer(obj: any, _argumentName?: string): obj is PythonVer {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (obj.major === null || typeof obj.major === "number") &&
    (obj.minor === null || typeof obj.minor === "number") &&
    (obj.patch === null || typeof obj.patch === "number")
  )
}

export function isRunResult(obj: any, _argumentName?: string): obj is RunResult {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (isRunStatus(obj.status) as boolean) &&
    Array.isArray(obj.testResults) &&
    obj.testResults.every((e: any) => isTestResult(e) as boolean) &&
    ((obj.logs !== null && typeof obj.logs === "object") || typeof obj.logs === "function") &&
    Object.entries<any>(obj.logs).every(
      ([key, value]) => typeof value === "string" && typeof key === "string",
    )
  )
}

export function isRunStatus(obj: any, _argumentName?: string): obj is RunStatus {
  return (
    obj === "PASSED" ||
    obj === "TESTS_FAILED" ||
    obj === "COMPILE_FAILED" ||
    obj === "TESTRUN_INTERRUPTED" ||
    obj === "GENERIC_ERROR"
  )
}

export function isTestResult(obj: any, _argumentName?: string): obj is TestResult {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.name === "string" &&
    typeof obj.successful === "boolean" &&
    Array.isArray(obj.points) &&
    obj.points.every((e: any) => typeof e === "string") &&
    typeof obj.message === "string" &&
    Array.isArray(obj.exception) &&
    obj.exception.every((e: any) => typeof e === "string")
  )
}

export function isExerciseDesc(obj: any, _argumentName?: string): obj is ExerciseDesc {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.name === "string" &&
    Array.isArray(obj.tests) &&
    obj.tests.every((e: any) => isTestDesc(e) as boolean)
  )
}

export function isTestDesc(obj: any, _argumentName?: string): obj is TestDesc {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.name === "string" &&
    Array.isArray(obj.points) &&
    obj.points.every((e: any) => typeof e === "string")
  )
}

export function isUpdatedExercise(obj: any, _argumentName?: string): obj is UpdatedExercise {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "number"
  )
}

export function isDownloadOrUpdateCourseExercisesResult(
  obj: any,
  _argumentName?: string,
): obj is DownloadOrUpdateCourseExercisesResult {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    Array.isArray(obj.downloaded) &&
    obj.downloaded.every((e: any) => isExerciseDownload(e) as boolean) &&
    Array.isArray(obj.skipped) &&
    obj.skipped.every((e: any) => isExerciseDownload(e) as boolean) &&
    (typeof obj.failed === "undefined" ||
      (Array.isArray(obj.failed) &&
        obj.failed.every(
          (e: any) =>
            Array.isArray(e) &&
            (isExerciseDownload(e[0]) as boolean) &&
            Array.isArray(e[1]) &&
            e[1].every((e: any) => typeof e === "string"),
        )))
  )
}

export function isExerciseDownload(obj: any, _argumentName?: string): obj is ExerciseDownload {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "number" &&
    typeof obj.course_slug === "string" &&
    typeof obj.exercise_slug === "string" &&
    typeof obj.path === "string"
  )
}

export function isCombinedCourseData(obj: any, _argumentName?: string): obj is CombinedCourseData {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (isCourseDetails(obj.details) as boolean) &&
    Array.isArray(obj.exercises) &&
    obj.exercises.every((e: any) => isCourseExercise(e) as boolean) &&
    (isCourseData(obj.settings) as boolean)
  )
}

export function isCourseDetails(obj: any, _argumentName?: string): obj is CourseDetails {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "number" &&
    typeof obj.name === "string" &&
    typeof obj.title === "string" &&
    (obj.description === null || typeof obj.description === "string") &&
    typeof obj.details_url === "string" &&
    typeof obj.unlock_url === "string" &&
    typeof obj.reviews_url === "string" &&
    typeof obj.comet_url === "string" &&
    Array.isArray(obj.spyware_urls) &&
    obj.spyware_urls.every((e: any) => typeof e === "string") &&
    Array.isArray(obj.unlockables) &&
    obj.unlockables.every((e: any) => typeof e === "string") &&
    Array.isArray(obj.exercises) &&
    obj.exercises.every((e: any) => isExercise(e) as boolean)
  )
}

export function isExercise(obj: any, _argumentName?: string): obj is Exercise {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "number" &&
    typeof obj.name === "string" &&
    typeof obj.locked === "boolean" &&
    (obj.deadline_description === null || typeof obj.deadline_description === "string") &&
    (obj.deadline === null || typeof obj.deadline === "string") &&
    (obj.soft_deadline === null || typeof obj.soft_deadline === "string") &&
    (obj.soft_deadline_description === null || typeof obj.soft_deadline_description === "string") &&
    typeof obj.checksum === "string" &&
    typeof obj.return_url === "string" &&
    typeof obj.zip_url === "string" &&
    typeof obj.returnable === "boolean" &&
    typeof obj.requires_review === "boolean" &&
    typeof obj.attempted === "boolean" &&
    typeof obj.completed === "boolean" &&
    typeof obj.reviewed === "boolean" &&
    typeof obj.all_review_points_given === "boolean" &&
    (obj.memory_limit === null || typeof obj.memory_limit === "number") &&
    Array.isArray(obj.runtime_params) &&
    obj.runtime_params.every((e: any) => typeof e === "string") &&
    (obj.valgrind_strategy === null || typeof obj.valgrind_strategy === "string") &&
    typeof obj.code_review_requests_enabled === "boolean" &&
    typeof obj.run_tests_locally_action_enabled === "boolean" &&
    (obj.latest_submission_url === null || typeof obj.latest_submission_url === "string") &&
    (obj.latest_submission_id === null || typeof obj.latest_submission_id === "number") &&
    (obj.solution_zip_url === null || typeof obj.solution_zip_url === "string")
  )
}

export function isCourseExercise(obj: any, _argumentName?: string): obj is CourseExercise {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "number" &&
    Array.isArray(obj.available_points) &&
    obj.available_points.every((e: any) => isExercisePoint(e) as boolean) &&
    Array.isArray(obj.awarded_points) &&
    obj.awarded_points.every((e: any) => typeof e === "string") &&
    typeof obj.name === "string" &&
    (obj.publish_time === null || typeof obj.publish_time === "string") &&
    (obj.solution_visible_after === null || typeof obj.solution_visible_after === "string") &&
    (obj.deadline === null || typeof obj.deadline === "string") &&
    (obj.soft_deadline === null || typeof obj.soft_deadline === "string") &&
    typeof obj.disabled === "boolean" &&
    typeof obj.unlocked === "boolean"
  )
}

export function isExercisePoint(obj: any, _argumentName?: string): obj is ExercisePoint {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "number" &&
    typeof obj.exercise_id === "number" &&
    typeof obj.name === "string" &&
    typeof obj.requires_review === "boolean"
  )
}

export function isCourseData(obj: any, _argumentName?: string): obj is CourseData {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.name === "string" &&
    (obj.hide_after === null || typeof obj.hide_after === "string") &&
    typeof obj.hidden === "boolean" &&
    (obj.cache_version === null || typeof obj.cache_version === "number") &&
    (obj.spreadsheet_key === null || typeof obj.spreadsheet_key === "string") &&
    (obj.hidden_if_registered_after === null ||
      typeof obj.hidden_if_registered_after === "string") &&
    (obj.refreshed_at === null || typeof obj.refreshed_at === "string") &&
    typeof obj.locked_exercise_points_visible === "boolean" &&
    (obj.description === null || typeof obj.description === "string") &&
    (obj.paste_visibility === null || typeof obj.paste_visibility === "number") &&
    (obj.formal_name === null || typeof obj.formal_name === "string") &&
    (obj.certificate_downloadable === null ||
      obj.certificate_downloadable === false ||
      obj.certificate_downloadable === true) &&
    (obj.certificate_unlock_spec === null || typeof obj.certificate_unlock_spec === "string") &&
    (obj.organization_id === null || typeof obj.organization_id === "number") &&
    (obj.disabled_status === null || typeof obj.disabled_status === "string") &&
    (obj.title === null || typeof obj.title === "string") &&
    (obj.material_url === null || typeof obj.material_url === "string") &&
    (obj.course_template_id === null || typeof obj.course_template_id === "number") &&
    typeof obj.hide_submission_results === "boolean" &&
    (obj.external_scoreboard_url === null || typeof obj.external_scoreboard_url === "string") &&
    (obj.organization_slug === null || typeof obj.organization_slug === "string")
  )
}

export function isExerciseDetails(obj: any, _argumentName?: string): obj is ExerciseDetails {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.course_name === "string" &&
    typeof obj.course_id === "number" &&
    typeof obj.code_review_requests_enabled === "boolean" &&
    typeof obj.run_tests_locally_action_enabled === "boolean" &&
    typeof obj.exercise_name === "string" &&
    typeof obj.exercise_id === "number" &&
    (obj.unlocked_at === null || typeof obj.unlocked_at === "string") &&
    (obj.deadline === null || typeof obj.deadline === "string") &&
    Array.isArray(obj.submissions) &&
    obj.submissions.every((e: any) => isExerciseSubmission(e) as boolean)
  )
}

export function isExerciseSubmission(obj: any, _argumentName?: string): obj is ExerciseSubmission {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.exercise_name === "string" &&
    typeof obj.id === "number" &&
    typeof obj.user_id === "number" &&
    typeof obj.course_id === "number" &&
    typeof obj.created_at === "string" &&
    typeof obj.all_tests_passed === "boolean" &&
    (obj.points === null || typeof obj.points === "string") &&
    typeof obj.submitted_zip_url === "string" &&
    (obj.paste_url === null || typeof obj.paste_url === "string") &&
    (obj.processing_time === null || typeof obj.processing_time === "number") &&
    typeof obj.reviewed === "boolean" &&
    typeof obj.requests_review === "boolean"
  )
}

export function isSubmission(obj: any, _argumentName?: string): obj is Submission {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "number" &&
    typeof obj.user_id === "number" &&
    (obj.pretest_error === null || typeof obj.pretest_error === "string") &&
    typeof obj.created_at === "string" &&
    typeof obj.exercise_name === "string" &&
    typeof obj.course_id === "number" &&
    typeof obj.processed === "boolean" &&
    typeof obj.all_tests_passed === "boolean" &&
    (obj.points === null || typeof obj.points === "string") &&
    (obj.processing_tried_at === null || typeof obj.processing_tried_at === "string") &&
    (obj.processing_began_at === null || typeof obj.processing_began_at === "string") &&
    (obj.processing_completed_at === null || typeof obj.processing_completed_at === "string") &&
    typeof obj.times_sent_to_sandbox === "number" &&
    typeof obj.processing_attempts_started_at === "string" &&
    (obj.params_json === null || typeof obj.params_json === "string") &&
    typeof obj.requires_review === "boolean" &&
    typeof obj.requests_review === "boolean" &&
    typeof obj.reviewed === "boolean" &&
    typeof obj.message_for_reviewer === "string" &&
    typeof obj.newer_submission_reviewed === "boolean" &&
    typeof obj.review_dismissed === "boolean" &&
    typeof obj.paste_available === "boolean" &&
    typeof obj.message_for_paste === "string" &&
    (obj.paste_key === null || typeof obj.paste_key === "string")
  )
}

export function isUpdateResult(obj: any, _argumentName?: string): obj is UpdateResult {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    Array.isArray(obj.created) &&
    obj.created.every((e: any) => isExercise(e) as boolean) &&
    Array.isArray(obj.updated) &&
    obj.updated.every((e: any) => isExercise(e) as boolean)
  )
}

export function isOrganization(obj: any, _argumentName?: string): obj is Organization {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.name === "string" &&
    typeof obj.information === "string" &&
    typeof obj.slug === "string" &&
    typeof obj.logo_path === "string" &&
    typeof obj.pinned === "boolean"
  )
}

export function isReview(obj: any, _argumentName?: string): obj is Review {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.submission_id === "number" &&
    typeof obj.exercise_name === "string" &&
    typeof obj.id === "number" &&
    typeof obj.marked_as_read === "boolean" &&
    typeof obj.reviewer_name === "string" &&
    typeof obj.review_body === "string" &&
    Array.isArray(obj.points) &&
    obj.points.every((e: any) => typeof e === "string") &&
    Array.isArray(obj.points_not_awarded) &&
    obj.points_not_awarded.every((e: any) => typeof e === "string") &&
    typeof obj.url === "string" &&
    typeof obj.update_url === "string" &&
    typeof obj.created_at === "string" &&
    typeof obj.updated_at === "string"
  )
}

export function isNewSubmission(obj: any, _argumentName?: string): obj is NewSubmission {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.show_submission_url === "string" &&
    typeof obj.paste_url === "string" &&
    typeof obj.submission_url === "string"
  )
}

export function isSubmissionFeedbackResponse(
  obj: any,
  _argumentName?: string,
): obj is SubmissionFeedbackResponse {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.api_version === "number" &&
    (isSubmissionStatus(obj.status) as boolean)
  )
}

export function isSubmissionStatus(obj: any, _argumentName?: string): obj is SubmissionStatus {
  return (
    obj === "processing" || obj === "fail" || obj === "ok" || obj === "error" || obj === "hidden"
  )
}

export function isSubmissionFinished(obj: any, _argumentName?: string): obj is SubmissionFinished {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.api_version === "number" &&
    (obj.all_tests_passed === null ||
      obj.all_tests_passed === false ||
      obj.all_tests_passed === true) &&
    typeof obj.user_id === "number" &&
    typeof obj.login === "string" &&
    typeof obj.course === "string" &&
    typeof obj.exercise_name === "string" &&
    (isSubmissionStatus(obj.status) as boolean) &&
    Array.isArray(obj.points) &&
    obj.points.every((e: any) => typeof e === "string") &&
    (obj.valgrind === null || typeof obj.valgrind === "string") &&
    typeof obj.submission_url === "string" &&
    (obj.solution_url === null || typeof obj.solution_url === "string") &&
    typeof obj.submitted_at === "string" &&
    (obj.processing_time === null || typeof obj.processing_time === "number") &&
    typeof obj.reviewed === "boolean" &&
    typeof obj.requests_review === "boolean" &&
    (obj.paste_url === null || typeof obj.paste_url === "string") &&
    (obj.message_for_paste === null || typeof obj.message_for_paste === "string") &&
    Array.isArray(obj.missing_review_points) &&
    obj.missing_review_points.every((e: any) => typeof e === "string") &&
    (obj.test_cases === null ||
      (Array.isArray(obj.test_cases) &&
        obj.test_cases.every((e: any) => isTestCase(e) as boolean))) &&
    (obj.feedback_questions === null ||
      (Array.isArray(obj.feedback_questions) &&
        obj.feedback_questions.every((e: any) => isSubmissionFeedbackQuestion(e) as boolean))) &&
    (obj.feedback_answer_url === null || typeof obj.feedback_answer_url === "string") &&
    (obj.error === null || typeof obj.error === "string") &&
    (obj.validations === null || (isStyleValidationResult(obj.validations) as boolean))
  )
}

export function isTestCase(obj: any, _argumentName?: string): obj is TestCase {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.name === "string" &&
    typeof obj.successful === "boolean" &&
    (obj.message === null || typeof obj.message === "string") &&
    (obj.exception === null ||
      (Array.isArray(obj.exception) && obj.exception.every((e: any) => typeof e === "string"))) &&
    (obj.detailed_message === null || typeof obj.detailed_message === "string")
  )
}

export function isSubmissionFeedbackQuestion(
  obj: any,
  _argumentName?: string,
): obj is SubmissionFeedbackQuestion {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "number" &&
    typeof obj.question === "string" &&
    (isSubmissionFeedbackKind(obj.kind) as boolean)
  )
}

export function isSubmissionFeedbackKind(
  obj: any,
  _argumentName?: string,
): obj is SubmissionFeedbackKind {
  return (
    obj === "Text" ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      ((obj.IntRange !== null && typeof obj.IntRange === "object") ||
        typeof obj.IntRange === "function") &&
      typeof obj.IntRange.lower === "number" &&
      typeof obj.IntRange.upper === "number")
  )
}

export function isTmcConfig(obj: any, _argumentName?: string): obj is TmcConfig {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.projects_dir === "string"
  )
}
