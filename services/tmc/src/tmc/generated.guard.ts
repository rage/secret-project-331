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

export function isStyleValidationResult(obj: unknown): obj is StyleValidationResult {
  const typedObj = obj as StyleValidationResult
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (isStyleValidationStrategy(typedObj["strategy"]) as boolean) &&
    (typedObj["validationErrors"] === null ||
      (((typedObj["validationErrors"] !== null &&
        typeof typedObj["validationErrors"] === "object") ||
        typeof typedObj["validationErrors"] === "function") &&
        Object.entries<any>(typedObj["validationErrors"]).every(
          ([key, value]) =>
            Array.isArray(value) &&
            value.every((e: any) => isStyleValidationError(e) as boolean) &&
            typeof key === "string",
        )))
  )
}

export function isStyleValidationError(obj: unknown): obj is StyleValidationError {
  const typedObj = obj as StyleValidationError
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["column"] === "number" &&
    typeof typedObj["line"] === "number" &&
    typeof typedObj["message"] === "string" &&
    typeof typedObj["sourceName"] === "string"
  )
}

export function isStyleValidationStrategy(obj: unknown): obj is StyleValidationStrategy {
  const typedObj = obj as StyleValidationStrategy
  return typedObj === "FAIL" || typedObj === "WARN" || typedObj === "DISABLED"
}

export function isExercisePackagingConfiguration(
  obj: unknown,
): obj is ExercisePackagingConfiguration {
  const typedObj = obj as ExercisePackagingConfiguration
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    Array.isArray(typedObj["student_file_paths"]) &&
    typedObj["student_file_paths"].every((e: any) => typeof e === "string") &&
    Array.isArray(typedObj["exercise_file_paths"]) &&
    typedObj["exercise_file_paths"].every((e: any) => typeof e === "string")
  )
}

export function isLocalExercise(obj: unknown): obj is LocalExercise {
  const typedObj = obj as LocalExercise
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["exercise-slug"] === "string" &&
    typeof typedObj["exercise-path"] === "string"
  )
}

export function isCompression(obj: unknown): obj is Compression {
  const typedObj = obj as Compression
  return typedObj === "tar" || typedObj === "zip" || typedObj === "zstd"
}

export function isRefreshData(obj: unknown): obj is RefreshData {
  const typedObj = obj as RefreshData
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["new-cache-path"] === "string" &&
    typeof typedObj["course-options"] === "object" &&
    Array.isArray(typedObj["exercises"]) &&
    typedObj["exercises"].every((e: any) => isRefreshExercise(e) as boolean)
  )
}

export function isRefreshExercise(obj: unknown): obj is RefreshExercise {
  const typedObj = obj as RefreshExercise
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["name"] === "string" &&
    typeof typedObj["checksum"] === "string" &&
    Array.isArray(typedObj["points"]) &&
    typedObj["points"].every((e: any) => typeof e === "string") &&
    typeof typedObj["sandbox-image"] === "string" &&
    (typedObj["tmcproject-yml"] === null ||
      (isTmcProjectYml(typedObj["tmcproject-yml"]) as boolean))
  )
}

export function isTmcProjectYml(obj: unknown): obj is TmcProjectYml {
  const typedObj = obj as TmcProjectYml
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    Array.isArray(typedObj["extra_student_files"]) &&
    typedObj["extra_student_files"].every((e: any) => typeof e === "string") &&
    Array.isArray(typedObj["extra_exercise_files"]) &&
    typedObj["extra_exercise_files"].every((e: any) => typeof e === "string") &&
    Array.isArray(typedObj["force_update"]) &&
    typedObj["force_update"].every((e: any) => typeof e === "string") &&
    (typeof typedObj["tests_timeout_ms"] === "undefined" ||
      typeof typedObj["tests_timeout_ms"] === "bigint") &&
    (typeof typedObj["fail_on_valgrind_error"] === "undefined" ||
      typedObj["fail_on_valgrind_error"] === false ||
      typedObj["fail_on_valgrind_error"] === true) &&
    (typeof typedObj["minimum_python_version"] === "undefined" ||
      (isPythonVer(typedObj["minimum_python_version"]) as boolean)) &&
    (typeof typedObj["sandbox_image"] === "undefined" ||
      typeof typedObj["sandbox_image"] === "string")
  )
}

export function isPythonVer(obj: unknown): obj is PythonVer {
  const typedObj = obj as PythonVer
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["major"] === "number" &&
    (typedObj["minor"] === null || typeof typedObj["minor"] === "number") &&
    (typedObj["patch"] === null || typeof typedObj["patch"] === "number")
  )
}

export function isRunResult(obj: unknown): obj is RunResult {
  const typedObj = obj as RunResult
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (isRunStatus(typedObj["status"]) as boolean) &&
    Array.isArray(typedObj["testResults"]) &&
    typedObj["testResults"].every((e: any) => isTestResult(e) as boolean) &&
    ((typedObj["logs"] !== null && typeof typedObj["logs"] === "object") ||
      typeof typedObj["logs"] === "function") &&
    Object.entries<any>(typedObj["logs"]).every(
      ([key, value]) => typeof value === "string" && typeof key === "string",
    )
  )
}

export function isRunStatus(obj: unknown): obj is RunStatus {
  const typedObj = obj as RunStatus
  return (
    typedObj === "PASSED" ||
    typedObj === "TESTS_FAILED" ||
    typedObj === "COMPILE_FAILED" ||
    typedObj === "TESTRUN_INTERRUPTED" ||
    typedObj === "GENERIC_ERROR"
  )
}

export function isTestResult(obj: unknown): obj is TestResult {
  const typedObj = obj as TestResult
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["name"] === "string" &&
    typeof typedObj["successful"] === "boolean" &&
    Array.isArray(typedObj["points"]) &&
    typedObj["points"].every((e: any) => typeof e === "string") &&
    typeof typedObj["message"] === "string" &&
    Array.isArray(typedObj["exception"]) &&
    typedObj["exception"].every((e: any) => typeof e === "string")
  )
}

export function isExerciseDesc(obj: unknown): obj is ExerciseDesc {
  const typedObj = obj as ExerciseDesc
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["name"] === "string" &&
    Array.isArray(typedObj["tests"]) &&
    typedObj["tests"].every((e: any) => isTestDesc(e) as boolean)
  )
}

export function isTestDesc(obj: unknown): obj is TestDesc {
  const typedObj = obj as TestDesc
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["name"] === "string" &&
    Array.isArray(typedObj["points"]) &&
    typedObj["points"].every((e: any) => typeof e === "string")
  )
}

export function isUpdatedExercise(obj: unknown): obj is UpdatedExercise {
  const typedObj = obj as UpdatedExercise
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "number"
  )
}

export function isDownloadOrUpdateCourseExercisesResult(
  obj: unknown,
): obj is DownloadOrUpdateCourseExercisesResult {
  const typedObj = obj as DownloadOrUpdateCourseExercisesResult
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    Array.isArray(typedObj["downloaded"]) &&
    typedObj["downloaded"].every((e: any) => isExerciseDownload(e) as boolean) &&
    Array.isArray(typedObj["skipped"]) &&
    typedObj["skipped"].every((e: any) => isExerciseDownload(e) as boolean) &&
    (typeof typedObj["failed"] === "undefined" ||
      (Array.isArray(typedObj["failed"]) &&
        typedObj["failed"].every(
          (e: any) =>
            Array.isArray(e) &&
            (isExerciseDownload(e[0]) as boolean) &&
            Array.isArray(e[1]) &&
            e[1].every((e: any) => typeof e === "string"),
        )))
  )
}

export function isExerciseDownload(obj: unknown): obj is ExerciseDownload {
  const typedObj = obj as ExerciseDownload
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "number" &&
    typeof typedObj["course-slug"] === "string" &&
    typeof typedObj["exercise-slug"] === "string" &&
    typeof typedObj["path"] === "string"
  )
}

export function isCombinedCourseData(obj: unknown): obj is CombinedCourseData {
  const typedObj = obj as CombinedCourseData
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (isCourseDetails(typedObj["details"]) as boolean) &&
    Array.isArray(typedObj["exercises"]) &&
    typedObj["exercises"].every((e: any) => isCourseExercise(e) as boolean) &&
    (isCourseData(typedObj["settings"]) as boolean)
  )
}

export function isCourseDetails(obj: unknown): obj is CourseDetails {
  const typedObj = obj as CourseDetails
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "number" &&
    typeof typedObj["name"] === "string" &&
    typeof typedObj["title"] === "string" &&
    (typedObj["description"] === null || typeof typedObj["description"] === "string") &&
    typeof typedObj["details_url"] === "string" &&
    typeof typedObj["unlock_url"] === "string" &&
    typeof typedObj["reviews_url"] === "string" &&
    typeof typedObj["comet_url"] === "string" &&
    Array.isArray(typedObj["spyware_urls"]) &&
    typedObj["spyware_urls"].every((e: any) => typeof e === "string") &&
    Array.isArray(typedObj["unlockables"]) &&
    typedObj["unlockables"].every((e: any) => typeof e === "string") &&
    Array.isArray(typedObj["exercises"]) &&
    typedObj["exercises"].every((e: any) => isExercise(e) as boolean)
  )
}

export function isExercise(obj: unknown): obj is Exercise {
  const typedObj = obj as Exercise
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "number" &&
    typeof typedObj["name"] === "string" &&
    typeof typedObj["locked"] === "boolean" &&
    (typedObj["deadline_description"] === null ||
      typeof typedObj["deadline_description"] === "string") &&
    (typedObj["deadline"] === null || typeof typedObj["deadline"] === "string") &&
    (typedObj["soft_deadline"] === null || typeof typedObj["soft_deadline"] === "string") &&
    (typedObj["soft_deadline_description"] === null ||
      typeof typedObj["soft_deadline_description"] === "string") &&
    typeof typedObj["checksum"] === "string" &&
    typeof typedObj["return_url"] === "string" &&
    typeof typedObj["zip_url"] === "string" &&
    typeof typedObj["returnable"] === "boolean" &&
    typeof typedObj["requires_review"] === "boolean" &&
    typeof typedObj["attempted"] === "boolean" &&
    typeof typedObj["completed"] === "boolean" &&
    typeof typedObj["reviewed"] === "boolean" &&
    typeof typedObj["all_review_points_given"] === "boolean" &&
    (typedObj["memory_limit"] === null || typeof typedObj["memory_limit"] === "number") &&
    Array.isArray(typedObj["runtime_params"]) &&
    typedObj["runtime_params"].every((e: any) => typeof e === "string") &&
    (typedObj["valgrind_strategy"] === null || typeof typedObj["valgrind_strategy"] === "string") &&
    typeof typedObj["code_review_requests_enabled"] === "boolean" &&
    typeof typedObj["run_tests_locally_action_enabled"] === "boolean" &&
    (typedObj["latest_submission_url"] === null ||
      typeof typedObj["latest_submission_url"] === "string") &&
    (typedObj["latest_submission_id"] === null ||
      typeof typedObj["latest_submission_id"] === "number") &&
    (typedObj["solution_zip_url"] === null || typeof typedObj["solution_zip_url"] === "string")
  )
}

export function isCourseExercise(obj: unknown): obj is CourseExercise {
  const typedObj = obj as CourseExercise
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "number" &&
    Array.isArray(typedObj["available_points"]) &&
    typedObj["available_points"].every((e: any) => isExercisePoint(e) as boolean) &&
    Array.isArray(typedObj["awarded_points"]) &&
    typedObj["awarded_points"].every((e: any) => typeof e === "string") &&
    typeof typedObj["name"] === "string" &&
    (typedObj["publish_time"] === null || typeof typedObj["publish_time"] === "string") &&
    (typedObj["solution_visible_after"] === null ||
      typeof typedObj["solution_visible_after"] === "string") &&
    (typedObj["deadline"] === null || typeof typedObj["deadline"] === "string") &&
    (typedObj["soft_deadline"] === null || typeof typedObj["soft_deadline"] === "string") &&
    typeof typedObj["disabled"] === "boolean" &&
    typeof typedObj["unlocked"] === "boolean"
  )
}

export function isExercisePoint(obj: unknown): obj is ExercisePoint {
  const typedObj = obj as ExercisePoint
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "number" &&
    typeof typedObj["exercise_id"] === "number" &&
    typeof typedObj["name"] === "string" &&
    typeof typedObj["requires_review"] === "boolean"
  )
}

export function isCourseData(obj: unknown): obj is CourseData {
  const typedObj = obj as CourseData
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["name"] === "string" &&
    (typedObj["hide_after"] === null || typeof typedObj["hide_after"] === "string") &&
    typeof typedObj["hidden"] === "boolean" &&
    (typedObj["cache_version"] === null || typeof typedObj["cache_version"] === "number") &&
    (typedObj["spreadsheet_key"] === null || typeof typedObj["spreadsheet_key"] === "string") &&
    (typedObj["hidden_if_registered_after"] === null ||
      typeof typedObj["hidden_if_registered_after"] === "string") &&
    (typedObj["refreshed_at"] === null || typeof typedObj["refreshed_at"] === "string") &&
    typeof typedObj["locked_exercise_points_visible"] === "boolean" &&
    (typedObj["description"] === null || typeof typedObj["description"] === "string") &&
    (typedObj["paste_visibility"] === null || typeof typedObj["paste_visibility"] === "number") &&
    (typedObj["formal_name"] === null || typeof typedObj["formal_name"] === "string") &&
    (typedObj["certificate_downloadable"] === null ||
      typedObj["certificate_downloadable"] === false ||
      typedObj["certificate_downloadable"] === true) &&
    (typedObj["certificate_unlock_spec"] === null ||
      typeof typedObj["certificate_unlock_spec"] === "string") &&
    (typedObj["organization_id"] === null || typeof typedObj["organization_id"] === "number") &&
    (typedObj["disabled_status"] === null || typeof typedObj["disabled_status"] === "string") &&
    (typedObj["title"] === null || typeof typedObj["title"] === "string") &&
    (typedObj["material_url"] === null || typeof typedObj["material_url"] === "string") &&
    (typedObj["course_template_id"] === null ||
      typeof typedObj["course_template_id"] === "number") &&
    typeof typedObj["hide_submission_results"] === "boolean" &&
    (typedObj["external_scoreboard_url"] === null ||
      typeof typedObj["external_scoreboard_url"] === "string") &&
    (typedObj["organization_slug"] === null || typeof typedObj["organization_slug"] === "string")
  )
}

export function isExerciseDetails(obj: unknown): obj is ExerciseDetails {
  const typedObj = obj as ExerciseDetails
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["course_name"] === "string" &&
    typeof typedObj["course_id"] === "number" &&
    typeof typedObj["code_review_requests_enabled"] === "boolean" &&
    typeof typedObj["run_tests_locally_action_enabled"] === "boolean" &&
    typeof typedObj["exercise_name"] === "string" &&
    typeof typedObj["exercise_id"] === "number" &&
    (typedObj["unlocked_at"] === null || typeof typedObj["unlocked_at"] === "string") &&
    (typedObj["deadline"] === null || typeof typedObj["deadline"] === "string") &&
    Array.isArray(typedObj["submissions"]) &&
    typedObj["submissions"].every((e: any) => isExerciseSubmission(e) as boolean)
  )
}

export function isExerciseSubmission(obj: unknown): obj is ExerciseSubmission {
  const typedObj = obj as ExerciseSubmission
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["exercise_name"] === "string" &&
    typeof typedObj["id"] === "number" &&
    typeof typedObj["user_id"] === "number" &&
    typeof typedObj["course_id"] === "number" &&
    typeof typedObj["created_at"] === "string" &&
    typeof typedObj["all_tests_passed"] === "boolean" &&
    (typedObj["points"] === null || typeof typedObj["points"] === "string") &&
    typeof typedObj["submitted_zip_url"] === "string" &&
    (typedObj["paste_url"] === null || typeof typedObj["paste_url"] === "string") &&
    (typedObj["processing_time"] === null || typeof typedObj["processing_time"] === "number") &&
    typeof typedObj["reviewed"] === "boolean" &&
    typeof typedObj["requests_review"] === "boolean"
  )
}

export function isSubmission(obj: unknown): obj is Submission {
  const typedObj = obj as Submission
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "number" &&
    typeof typedObj["user_id"] === "number" &&
    (typedObj["pretest_error"] === null || typeof typedObj["pretest_error"] === "string") &&
    typeof typedObj["created_at"] === "string" &&
    typeof typedObj["exercise_name"] === "string" &&
    typeof typedObj["course_id"] === "number" &&
    typeof typedObj["processed"] === "boolean" &&
    typeof typedObj["all_tests_passed"] === "boolean" &&
    (typedObj["points"] === null || typeof typedObj["points"] === "string") &&
    (typedObj["processing_tried_at"] === null ||
      typeof typedObj["processing_tried_at"] === "string") &&
    (typedObj["processing_began_at"] === null ||
      typeof typedObj["processing_began_at"] === "string") &&
    (typedObj["processing_completed_at"] === null ||
      typeof typedObj["processing_completed_at"] === "string") &&
    typeof typedObj["times_sent_to_sandbox"] === "number" &&
    typeof typedObj["processing_attempts_started_at"] === "string" &&
    (typedObj["params_json"] === null || typeof typedObj["params_json"] === "string") &&
    typeof typedObj["requires_review"] === "boolean" &&
    typeof typedObj["requests_review"] === "boolean" &&
    typeof typedObj["reviewed"] === "boolean" &&
    typeof typedObj["message_for_reviewer"] === "string" &&
    typeof typedObj["newer_submission_reviewed"] === "boolean" &&
    typeof typedObj["review_dismissed"] === "boolean" &&
    typeof typedObj["paste_available"] === "boolean" &&
    typeof typedObj["message_for_paste"] === "string" &&
    (typedObj["paste_key"] === null || typeof typedObj["paste_key"] === "string")
  )
}

export function isUpdateResult(obj: unknown): obj is UpdateResult {
  const typedObj = obj as UpdateResult
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    Array.isArray(typedObj["created"]) &&
    typedObj["created"].every((e: any) => isExercise(e) as boolean) &&
    Array.isArray(typedObj["updated"]) &&
    typedObj["updated"].every((e: any) => isExercise(e) as boolean)
  )
}

export function isOrganization(obj: unknown): obj is Organization {
  const typedObj = obj as Organization
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["name"] === "string" &&
    typeof typedObj["information"] === "string" &&
    typeof typedObj["slug"] === "string" &&
    typeof typedObj["logo_path"] === "string" &&
    typeof typedObj["pinned"] === "boolean"
  )
}

export function isReview(obj: unknown): obj is Review {
  const typedObj = obj as Review
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["submission_id"] === "number" &&
    typeof typedObj["exercise_name"] === "string" &&
    typeof typedObj["id"] === "number" &&
    typeof typedObj["marked_as_read"] === "boolean" &&
    typeof typedObj["reviewer_name"] === "string" &&
    typeof typedObj["review_body"] === "string" &&
    Array.isArray(typedObj["points"]) &&
    typedObj["points"].every((e: any) => typeof e === "string") &&
    Array.isArray(typedObj["points_not_awarded"]) &&
    typedObj["points_not_awarded"].every((e: any) => typeof e === "string") &&
    typeof typedObj["url"] === "string" &&
    typeof typedObj["update_url"] === "string" &&
    typeof typedObj["created_at"] === "string" &&
    typeof typedObj["updated_at"] === "string"
  )
}

export function isNewSubmission(obj: unknown): obj is NewSubmission {
  const typedObj = obj as NewSubmission
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["show_submission_url"] === "string" &&
    typeof typedObj["paste_url"] === "string" &&
    typeof typedObj["submission_url"] === "string"
  )
}

export function isSubmissionFeedbackResponse(obj: unknown): obj is SubmissionFeedbackResponse {
  const typedObj = obj as SubmissionFeedbackResponse
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["api_version"] === "number" &&
    (isSubmissionStatus(typedObj["status"]) as boolean)
  )
}

export function isSubmissionStatus(obj: unknown): obj is SubmissionStatus {
  const typedObj = obj as SubmissionStatus
  return (
    typedObj === "processing" ||
    typedObj === "fail" ||
    typedObj === "ok" ||
    typedObj === "error" ||
    typedObj === "hidden"
  )
}

export function isSubmissionFinished(obj: unknown): obj is SubmissionFinished {
  const typedObj = obj as SubmissionFinished
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["api_version"] === "number" &&
    (typedObj["all_tests_passed"] === null ||
      typedObj["all_tests_passed"] === false ||
      typedObj["all_tests_passed"] === true) &&
    typeof typedObj["user_id"] === "number" &&
    typeof typedObj["login"] === "string" &&
    typeof typedObj["course"] === "string" &&
    typeof typedObj["exercise_name"] === "string" &&
    (isSubmissionStatus(typedObj["status"]) as boolean) &&
    Array.isArray(typedObj["points"]) &&
    typedObj["points"].every((e: any) => typeof e === "string") &&
    (typedObj["valgrind"] === null || typeof typedObj["valgrind"] === "string") &&
    typeof typedObj["submission_url"] === "string" &&
    (typedObj["solution_url"] === null || typeof typedObj["solution_url"] === "string") &&
    typeof typedObj["submitted_at"] === "string" &&
    (typedObj["processing_time"] === null || typeof typedObj["processing_time"] === "number") &&
    typeof typedObj["reviewed"] === "boolean" &&
    typeof typedObj["requests_review"] === "boolean" &&
    (typedObj["paste_url"] === null || typeof typedObj["paste_url"] === "string") &&
    (typedObj["message_for_paste"] === null || typeof typedObj["message_for_paste"] === "string") &&
    Array.isArray(typedObj["missing_review_points"]) &&
    typedObj["missing_review_points"].every((e: any) => typeof e === "string") &&
    (typedObj["test_cases"] === null ||
      (Array.isArray(typedObj["test_cases"]) &&
        typedObj["test_cases"].every((e: any) => isTestCase(e) as boolean))) &&
    (typedObj["feedback_questions"] === null ||
      (Array.isArray(typedObj["feedback_questions"]) &&
        typedObj["feedback_questions"].every(
          (e: any) => isSubmissionFeedbackQuestion(e) as boolean,
        ))) &&
    (typedObj["feedback_answer_url"] === null ||
      typeof typedObj["feedback_answer_url"] === "string") &&
    (typedObj["error"] === null || typeof typedObj["error"] === "string") &&
    (typedObj["validations"] === null ||
      (isStyleValidationResult(typedObj["validations"]) as boolean))
  )
}

export function isTestCase(obj: unknown): obj is TestCase {
  const typedObj = obj as TestCase
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["name"] === "string" &&
    typeof typedObj["successful"] === "boolean" &&
    (typedObj["message"] === null || typeof typedObj["message"] === "string") &&
    (typedObj["exception"] === null ||
      (Array.isArray(typedObj["exception"]) &&
        typedObj["exception"].every((e: any) => typeof e === "string"))) &&
    (typedObj["detailed_message"] === null || typeof typedObj["detailed_message"] === "string")
  )
}

export function isSubmissionFeedbackQuestion(obj: unknown): obj is SubmissionFeedbackQuestion {
  const typedObj = obj as SubmissionFeedbackQuestion
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "number" &&
    typeof typedObj["question"] === "string" &&
    (isSubmissionFeedbackKind(typedObj["kind"]) as boolean)
  )
}

export function isSubmissionFeedbackKind(obj: unknown): obj is SubmissionFeedbackKind {
  const typedObj = obj as SubmissionFeedbackKind
  return (
    typedObj === "Text" ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      ((typedObj["IntRange"] !== null && typeof typedObj["IntRange"] === "object") ||
        typeof typedObj["IntRange"] === "function") &&
      typeof typedObj["IntRange"]["lower"] === "number" &&
      typeof typedObj["IntRange"]["upper"] === "number")
  )
}

export function isTmcConfig(obj: unknown): obj is TmcConfig {
  const typedObj = obj as TmcConfig
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["projects_dir"] === "string"
  )
}
