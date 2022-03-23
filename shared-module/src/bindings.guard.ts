/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

/*
 * Generated type guards for "bindings.ts".
 * WARNING: Do not manually change this file.
 */
import {
  Action,
  ActionOnResource,
  ActivityProgress,
  BlockProposal,
  BlockProposalAction,
  BlockProposalInfo,
  Chapter,
  ChapterScore,
  ChapterStatus,
  ChaptersWithStatus,
  ChapterUpdate,
  ChapterWithStatus,
  CmsPageExercise,
  CmsPageExerciseSlide,
  CmsPageExerciseTask,
  CmsPageUpdate,
  ContentManagementPage,
  Course,
  CourseCount,
  CourseExam,
  CourseInstance,
  CourseInstanceEnrollment,
  CourseInstanceForm,
  CourseMaterialExercise,
  CourseMaterialExerciseServiceInfo,
  CourseMaterialExerciseSlide,
  CourseMaterialExerciseTask,
  CoursePageWithUserData,
  CourseStructure,
  CourseUpdate,
  DatabaseChapter,
  EditProposalInfo,
  EmailTemplate,
  EmailTemplateNew,
  EmailTemplateUpdate,
  ErrorData,
  ErrorResponse,
  Exam,
  ExamCourseInfo,
  ExamData,
  ExamEnrollment,
  ExamEnrollmentData,
  ExamInstructions,
  ExamInstructionsUpdate,
  Exercise,
  ExerciseService,
  ExerciseServiceInfoApi,
  ExerciseServiceNewOrUpdate,
  ExerciseSlide,
  ExerciseSlideSubmission,
  ExerciseSlideSubmissionCount,
  ExerciseSlideSubmissionCountByExercise,
  ExerciseSlideSubmissionCountByWeekAndHour,
  ExerciseStatus,
  ExerciseSubmissions,
  ExerciseTask,
  ExerciseTaskGrading,
  ExerciseTaskGradingResult,
  ExerciseTaskSubmission,
  ExerciseUserCounts,
  ExerciseWithExerciseTasks,
  Feedback,
  FeedbackBlock,
  FeedbackCount,
  GetEditProposalsQuery,
  GetFeedbackQuery,
  GradingProgress,
  HistoryChangeReason,
  HistoryRestoreData,
  Login,
  MarkAsRead,
  NewChapter,
  NewCourse,
  NewExam,
  NewFeedback,
  NewPage,
  NewProposedBlockEdit,
  NewProposedPageEdits,
  Organization,
  OrgExam,
  Page,
  PageChapterAndCourseInformation,
  PageHistory,
  PageProposal,
  PageRoutingDataWithChapterStatus,
  PageSearchRequest,
  PageSearchResult,
  PageWithExercises,
  Pagination,
  PlaygroundExample,
  PlaygroundExampleData,
  PointMap,
  Points,
  ProposalCount,
  ProposalStatus,
  Resource,
  RoleDomain,
  RoleInfo,
  RoleQuery,
  RoleUser,
  StudentExerciseSlideSubmission,
  StudentExerciseSlideSubmissionResult,
  StudentExerciseTaskSubmission,
  StudentExerciseTaskSubmissionResult,
  SubmissionInfo,
  Term,
  TermUpdate,
  UploadResult,
  User,
  UserCourseInstanceChapterExerciseProgress,
  UserCourseInstanceChapterProgress,
  UserCourseInstanceProgress,
  UserCourseSettings,
  UserPointsUpdateStrategy,
  UserRole,
} from "./bindings"

export function isActionOnResource(obj: any, _argumentName?: string): obj is ActionOnResource {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (isAction(obj.action) as boolean) &&
    (isResource(obj.resource) as boolean)
  )
}

export function isAction(obj: any, _argumentName?: string): obj is Action {
  return (
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "view") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "edit") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "grade") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "teach") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "download") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "duplicate") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "delete_answer") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "edit_role" &&
      (isUserRole(obj.variant) as boolean)) ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "create_courses_or_exams")
  )
}

export function isResource(obj: any, _argumentName?: string): obj is Resource {
  return (
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "global_permissions") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "chapter" &&
      typeof obj.id === "string") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "course" &&
      typeof obj.id === "string") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "course_instance" &&
      typeof obj.id === "string") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "exam" &&
      typeof obj.id === "string") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "exercise" &&
      typeof obj.id === "string") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "exercise_slide_submission" &&
      typeof obj.id === "string") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "exercise_task" &&
      typeof obj.id === "string") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "exercise_task_grading" &&
      typeof obj.id === "string") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "exercise_task_submission" &&
      typeof obj.id === "string") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "organization" &&
      typeof obj.id === "string") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "page" &&
      typeof obj.id === "string") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "any_course") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "role") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "user") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "playground_example") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.type === "exercise_service")
  )
}

export function isTerm(obj: any, _argumentName?: string): obj is Term {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    typeof obj.term === "string" &&
    typeof obj.definition === "string"
  )
}

export function isTermUpdate(obj: any, _argumentName?: string): obj is TermUpdate {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.term === "string" &&
    typeof obj.definition === "string"
  )
}

export function isChapter(obj: any, _argumentName?: string): obj is Chapter {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date &&
    typeof obj.name === "string" &&
    typeof obj.course_id === "string" &&
    (obj.deleted_at === null || obj.deleted_at instanceof Date) &&
    (obj.chapter_image_url === null || typeof obj.chapter_image_url === "string") &&
    typeof obj.chapter_number === "number" &&
    (obj.front_page_id === null || typeof obj.front_page_id === "string") &&
    (obj.opens_at === null || obj.opens_at instanceof Date) &&
    (obj.deadline === null || obj.deadline instanceof Date) &&
    (obj.copied_from === null || typeof obj.copied_from === "string")
  )
}

export function isDatabaseChapter(obj: any, _argumentName?: string): obj is DatabaseChapter {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date &&
    typeof obj.name === "string" &&
    typeof obj.course_id === "string" &&
    (obj.deleted_at === null || obj.deleted_at instanceof Date) &&
    (obj.chapter_image_path === null || typeof obj.chapter_image_path === "string") &&
    typeof obj.chapter_number === "number" &&
    (obj.front_page_id === null || typeof obj.front_page_id === "string") &&
    (obj.opens_at === null || obj.opens_at instanceof Date) &&
    (obj.deadline === null || obj.deadline instanceof Date) &&
    (obj.copied_from === null || typeof obj.copied_from === "string")
  )
}

export function isChapterStatus(obj: any, _argumentName?: string): obj is ChapterStatus {
  return obj === "open" || obj === "closed"
}

export function isChapterUpdate(obj: any, _argumentName?: string): obj is ChapterUpdate {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.name === "string" &&
    (obj.front_page_id === null || typeof obj.front_page_id === "string") &&
    (obj.deadline === null || obj.deadline instanceof Date) &&
    (obj.opens_at === null || obj.opens_at instanceof Date)
  )
}

export function isChapterWithStatus(obj: any, _argumentName?: string): obj is ChapterWithStatus {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date &&
    typeof obj.name === "string" &&
    typeof obj.course_id === "string" &&
    (obj.deleted_at === null || obj.deleted_at instanceof Date) &&
    typeof obj.chapter_number === "number" &&
    (obj.front_page_id === null || typeof obj.front_page_id === "string") &&
    (obj.opens_at === null || obj.opens_at instanceof Date) &&
    (isChapterStatus(obj.status) as boolean)
  )
}

export function isNewChapter(obj: any, _argumentName?: string): obj is NewChapter {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.name === "string" &&
    typeof obj.course_id === "string" &&
    typeof obj.chapter_number === "number" &&
    (obj.front_page_id === null || typeof obj.front_page_id === "string") &&
    (obj.opens_at === null || obj.opens_at instanceof Date) &&
    (obj.deadline === null || obj.deadline instanceof Date)
  )
}

export function isUserCourseInstanceChapterProgress(
  obj: any,
  _argumentName?: string,
): obj is UserCourseInstanceChapterProgress {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.score_given === "number" &&
    typeof obj.score_maximum === "number"
  )
}

export function isCourseInstanceEnrollment(
  obj: any,
  _argumentName?: string,
): obj is CourseInstanceEnrollment {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.user_id === "string" &&
    typeof obj.course_id === "string" &&
    typeof obj.course_instance_id === "string" &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date &&
    (obj.deleted_at === null || obj.deleted_at instanceof Date)
  )
}

export function isChapterScore(obj: any, _argumentName?: string): obj is ChapterScore {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date &&
    typeof obj.name === "string" &&
    typeof obj.course_id === "string" &&
    (obj.deleted_at === null || obj.deleted_at instanceof Date) &&
    (obj.chapter_image_path === null || typeof obj.chapter_image_path === "string") &&
    typeof obj.chapter_number === "number" &&
    (obj.front_page_id === null || typeof obj.front_page_id === "string") &&
    (obj.opens_at === null || obj.opens_at instanceof Date) &&
    (obj.deadline === null || obj.deadline instanceof Date) &&
    (obj.copied_from === null || typeof obj.copied_from === "string") &&
    typeof obj.score_given === "number" &&
    typeof obj.score_total === "number"
  )
}

export function isCourseInstance(obj: any, _argumentName?: string): obj is CourseInstance {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date &&
    (obj.deleted_at === null || obj.deleted_at instanceof Date) &&
    typeof obj.course_id === "string" &&
    (obj.starts_at === null || obj.starts_at instanceof Date) &&
    (obj.ends_at === null || obj.ends_at instanceof Date) &&
    (obj.name === null || typeof obj.name === "string") &&
    (obj.description === null || typeof obj.description === "string") &&
    typeof obj.teacher_in_charge_name === "string" &&
    typeof obj.teacher_in_charge_email === "string" &&
    (obj.support_email === null || typeof obj.support_email === "string")
  )
}

export function isCourseInstanceForm(obj: any, _argumentName?: string): obj is CourseInstanceForm {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (obj.name === null || typeof obj.name === "string") &&
    (obj.description === null || typeof obj.description === "string") &&
    typeof obj.teacher_in_charge_name === "string" &&
    typeof obj.teacher_in_charge_email === "string" &&
    (obj.support_email === null || typeof obj.support_email === "string") &&
    (obj.opening_time === null || obj.opening_time instanceof Date) &&
    (obj.closing_time === null || obj.closing_time instanceof Date)
  )
}

export function isPointMap(obj: any, _argumentName?: string): obj is PointMap {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    Object.entries<any>(obj).every(
      ([key, value]) => typeof value === "number" && typeof key === "string",
    )
  )
}

export function isPoints(obj: any, _argumentName?: string): obj is Points {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    Array.isArray(obj.chapter_points) &&
    obj.chapter_points.every((e: any) => isChapterScore(e) as boolean) &&
    Array.isArray(obj.users) &&
    obj.users.every((e: any) => isUser(e) as boolean) &&
    ((obj.user_chapter_points !== null && typeof obj.user_chapter_points === "object") ||
      typeof obj.user_chapter_points === "function") &&
    Object.entries<any>(obj.user_chapter_points).every(
      ([key, value]) => (isPointMap(value) as boolean) && typeof key === "string",
    )
  )
}

export function isCourse(obj: any, _argumentName?: string): obj is Course {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    typeof obj.slug === "string" &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date &&
    typeof obj.name === "string" &&
    (obj.description === null || typeof obj.description === "string") &&
    typeof obj.organization_id === "string" &&
    (obj.deleted_at === null || obj.deleted_at instanceof Date) &&
    typeof obj.language_code === "string" &&
    (obj.copied_from === null || typeof obj.copied_from === "string") &&
    (obj.content_search_language === null || typeof obj.content_search_language === "string") &&
    typeof obj.course_language_group_id === "string" &&
    typeof obj.is_draft === "boolean"
  )
}

export function isCourseStructure(obj: any, _argumentName?: string): obj is CourseStructure {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (isCourse(obj.course) as boolean) &&
    Array.isArray(obj.pages) &&
    obj.pages.every((e: any) => isPage(e) as boolean) &&
    Array.isArray(obj.chapters) &&
    obj.chapters.every((e: any) => isChapter(e) as boolean)
  )
}

export function isCourseUpdate(obj: any, _argumentName?: string): obj is CourseUpdate {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.name === "string" &&
    typeof obj.is_draft === "boolean"
  )
}

export function isNewCourse(obj: any, _argumentName?: string): obj is NewCourse {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.name === "string" &&
    typeof obj.slug === "string" &&
    typeof obj.organization_id === "string" &&
    typeof obj.language_code === "string" &&
    typeof obj.teacher_in_charge_name === "string" &&
    typeof obj.teacher_in_charge_email === "string" &&
    typeof obj.description === "string" &&
    typeof obj.is_draft === "boolean"
  )
}

export function isCourseCount(obj: any, _argumentName?: string): obj is CourseCount {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.count === "number"
  )
}

export function isEmailTemplate(obj: any, _argumentName?: string): obj is EmailTemplate {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date &&
    (obj.deleted_at === null || obj.deleted_at instanceof Date) &&
    typeof obj.name === "string" &&
    (obj.subject === null || typeof obj.subject === "string") &&
    (obj.exercise_completions_threshold === null ||
      typeof obj.exercise_completions_threshold === "number") &&
    (obj.points_threshold === null || typeof obj.points_threshold === "number") &&
    typeof obj.course_instance_id === "string"
  )
}

export function isEmailTemplateNew(obj: any, _argumentName?: string): obj is EmailTemplateNew {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.name === "string"
  )
}

export function isEmailTemplateUpdate(
  obj: any,
  _argumentName?: string,
): obj is EmailTemplateUpdate {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.name === "string" &&
    typeof obj.subject === "string" &&
    (obj.exercise_completions_threshold === null ||
      typeof obj.exercise_completions_threshold === "number") &&
    (obj.points_threshold === null || typeof obj.points_threshold === "number")
  )
}

export function isCourseExam(obj: any, _argumentName?: string): obj is CourseExam {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    typeof obj.course_id === "string" &&
    typeof obj.course_name === "string" &&
    typeof obj.name === "string"
  )
}

export function isExam(obj: any, _argumentName?: string): obj is Exam {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.page_id === "string" &&
    Array.isArray(obj.courses) &&
    obj.courses.every((e: any) => isCourse(e) as boolean) &&
    (obj.starts_at === null || obj.starts_at instanceof Date) &&
    (obj.ends_at === null || obj.ends_at instanceof Date) &&
    typeof obj.time_minutes === "number"
  )
}

export function isExamEnrollment(obj: any, _argumentName?: string): obj is ExamEnrollment {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.user_id === "string" &&
    typeof obj.exam_id === "string" &&
    obj.started_at instanceof Date
  )
}

export function isNewExam(obj: any, _argumentName?: string): obj is NewExam {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    (obj.starts_at === null || obj.starts_at instanceof Date) &&
    (obj.ends_at === null || obj.ends_at instanceof Date) &&
    typeof obj.time_minutes === "number" &&
    typeof obj.organization_id === "string"
  )
}

export function isOrgExam(obj: any, _argumentName?: string): obj is OrgExam {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    (obj.starts_at === null || obj.starts_at instanceof Date) &&
    (obj.ends_at === null || obj.ends_at instanceof Date) &&
    typeof obj.time_minutes === "number" &&
    typeof obj.organization_id === "string"
  )
}

export function isExamInstructions(obj: any, _argumentName?: string): obj is ExamInstructions {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string"
  )
}

export function isExamInstructionsUpdate(
  obj: any,
  _argumentName?: string,
): obj is ExamInstructionsUpdate {
  return (obj !== null && typeof obj === "object") || typeof obj === "function"
}

export function isCourseMaterialExerciseServiceInfo(
  obj: any,
  _argumentName?: string,
): obj is CourseMaterialExerciseServiceInfo {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.exercise_iframe_url === "string"
  )
}

export function isExerciseServiceInfoApi(
  obj: any,
  _argumentName?: string,
): obj is ExerciseServiceInfoApi {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.service_name === "string" &&
    typeof obj.exercise_type_specific_user_interface_iframe === "string" &&
    typeof obj.grade_endpoint_path === "string" &&
    typeof obj.public_spec_endpoint_path === "string" &&
    typeof obj.model_solution_path === "string"
  )
}

export function isExerciseService(obj: any, _argumentName?: string): obj is ExerciseService {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date &&
    (obj.deleted_at === null || obj.deleted_at instanceof Date) &&
    typeof obj.name === "string" &&
    typeof obj.slug === "string" &&
    typeof obj.public_url === "string" &&
    (obj.internal_url === null || typeof obj.internal_url === "string") &&
    typeof obj.max_reprocessing_submissions_at_once === "number"
  )
}

export function isExerciseServiceNewOrUpdate(
  obj: any,
  _argumentName?: string,
): obj is ExerciseServiceNewOrUpdate {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.name === "string" &&
    typeof obj.slug === "string" &&
    typeof obj.public_url === "string" &&
    (obj.internal_url === null || typeof obj.internal_url === "string") &&
    typeof obj.max_reprocessing_submissions_at_once === "number"
  )
}

export function isCourseMaterialExerciseSlide(
  obj: any,
  _argumentName?: string,
): obj is CourseMaterialExerciseSlide {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    Array.isArray(obj.exercise_tasks) &&
    obj.exercise_tasks.every((e: any) => isCourseMaterialExerciseTask(e) as boolean)
  )
}

export function isExerciseSlide(obj: any, _argumentName?: string): obj is ExerciseSlide {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date &&
    (obj.deleted_at === null || obj.deleted_at instanceof Date) &&
    typeof obj.exercise_id === "string" &&
    typeof obj.order_number === "number"
  )
}

export function isCourseMaterialExerciseTask(
  obj: any,
  _argumentName?: string,
): obj is CourseMaterialExerciseTask {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    typeof obj.exercise_slide_id === "string" &&
    (obj.exercise_iframe_url === null || typeof obj.exercise_iframe_url === "string") &&
    (obj.previous_submission === null ||
      (isExerciseTaskSubmission(obj.previous_submission) as boolean)) &&
    (obj.previous_submission_grading === null ||
      (isExerciseTaskGrading(obj.previous_submission_grading) as boolean))
  )
}

export function isExerciseTask(obj: any, _argumentName?: string): obj is ExerciseTask {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date &&
    typeof obj.exercise_slide_id === "string" &&
    typeof obj.exercise_type === "string" &&
    (obj.deleted_at === null || obj.deleted_at instanceof Date) &&
    (obj.spec_file_id === null || typeof obj.spec_file_id === "string") &&
    (obj.copied_from === null || typeof obj.copied_from === "string")
  )
}

export function isActivityProgress(obj: any, _argumentName?: string): obj is ActivityProgress {
  return (
    obj === "Initialized" ||
    obj === "Started" ||
    obj === "InProgress" ||
    obj === "Submitted" ||
    obj === "Completed"
  )
}

export function isCourseMaterialExercise(
  obj: any,
  _argumentName?: string,
): obj is CourseMaterialExercise {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (isExercise(obj.exercise) as boolean) &&
    typeof obj.can_post_submission === "boolean" &&
    (isCourseMaterialExerciseSlide(obj.current_exercise_slide) as boolean) &&
    (obj.exercise_status === null || (isExerciseStatus(obj.exercise_status) as boolean)) &&
    (isPointMap(obj.exercise_slide_submission_counts) as boolean)
  )
}

export function isExercise(obj: any, _argumentName?: string): obj is Exercise {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date &&
    typeof obj.name === "string" &&
    (obj.course_id === null || typeof obj.course_id === "string") &&
    (obj.exam_id === null || typeof obj.exam_id === "string") &&
    typeof obj.page_id === "string" &&
    (obj.chapter_id === null || typeof obj.chapter_id === "string") &&
    (obj.deadline === null || obj.deadline instanceof Date) &&
    (obj.deleted_at === null || obj.deleted_at instanceof Date) &&
    typeof obj.score_maximum === "number" &&
    typeof obj.order_number === "number" &&
    (obj.copied_from === null || typeof obj.copied_from === "string") &&
    (obj.max_tries_per_slide === null || typeof obj.max_tries_per_slide === "number") &&
    typeof obj.limit_number_of_tries === "boolean"
  )
}

export function isExerciseStatus(obj: any, _argumentName?: string): obj is ExerciseStatus {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (obj.score_given === null || typeof obj.score_given === "number") &&
    (isActivityProgress(obj.activity_progress) as boolean) &&
    (isGradingProgress(obj.grading_progress) as boolean)
  )
}

export function isGradingProgress(obj: any, _argumentName?: string): obj is GradingProgress {
  return (
    obj === "FullyGraded" ||
    obj === "Pending" ||
    obj === "PendingManual" ||
    obj === "Failed" ||
    obj === "NotReady"
  )
}

export function isFeedback(obj: any, _argumentName?: string): obj is Feedback {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    (obj.user_id === null || typeof obj.user_id === "string") &&
    typeof obj.course_id === "string" &&
    (obj.page_id === null || typeof obj.page_id === "string") &&
    typeof obj.feedback_given === "string" &&
    (obj.selected_text === null || typeof obj.selected_text === "string") &&
    typeof obj.marked_as_read === "boolean" &&
    obj.created_at instanceof Date &&
    Array.isArray(obj.blocks) &&
    obj.blocks.every((e: any) => isFeedbackBlock(e) as boolean) &&
    (obj.page_title === null || typeof obj.page_title === "string") &&
    (obj.page_url_path === null || typeof obj.page_url_path === "string")
  )
}

export function isFeedbackBlock(obj: any, _argumentName?: string): obj is FeedbackBlock {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    (obj.text === null || typeof obj.text === "string") &&
    (obj.order_number === null || typeof obj.order_number === "number")
  )
}

export function isFeedbackCount(obj: any, _argumentName?: string): obj is FeedbackCount {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.read === "number" &&
    typeof obj.unread === "number"
  )
}

export function isNewFeedback(obj: any, _argumentName?: string): obj is NewFeedback {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.feedback_given === "string" &&
    (obj.selected_text === null || typeof obj.selected_text === "string") &&
    Array.isArray(obj.related_blocks) &&
    obj.related_blocks.every((e: any) => isFeedbackBlock(e) as boolean) &&
    typeof obj.page_id === "string"
  )
}

export function isOrganization(obj: any, _argumentName?: string): obj is Organization {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    typeof obj.slug === "string" &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date &&
    typeof obj.name === "string" &&
    (obj.description === null || typeof obj.description === "string") &&
    (obj.organization_image_url === null || typeof obj.organization_image_url === "string") &&
    (obj.deleted_at === null || obj.deleted_at instanceof Date)
  )
}

export function isPageHistory(obj: any, _argumentName?: string): obj is PageHistory {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    obj.created_at instanceof Date &&
    typeof obj.title === "string" &&
    (isHistoryChangeReason(obj.history_change_reason) as boolean) &&
    (obj.restored_from_id === null || typeof obj.restored_from_id === "string") &&
    typeof obj.author_user_id === "string"
  )
}

export function isHistoryChangeReason(
  obj: any,
  _argumentName?: string,
): obj is HistoryChangeReason {
  return obj === "PageSaved" || obj === "HistoryRestored"
}

export function isCmsPageExercise(obj: any, _argumentName?: string): obj is CmsPageExercise {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.order_number === "number" &&
    typeof obj.score_maximum === "number" &&
    (obj.max_tries_per_slide === null || typeof obj.max_tries_per_slide === "number") &&
    typeof obj.limit_number_of_tries === "boolean"
  )
}

export function isCmsPageExerciseSlide(
  obj: any,
  _argumentName?: string,
): obj is CmsPageExerciseSlide {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    typeof obj.exercise_id === "string" &&
    typeof obj.order_number === "number"
  )
}

export function isCmsPageExerciseTask(
  obj: any,
  _argumentName?: string,
): obj is CmsPageExerciseTask {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    typeof obj.exercise_slide_id === "string" &&
    typeof obj.exercise_type === "string"
  )
}

export function isCmsPageUpdate(obj: any, _argumentName?: string): obj is CmsPageUpdate {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    Array.isArray(obj.exercises) &&
    obj.exercises.every((e: any) => isCmsPageExercise(e) as boolean) &&
    Array.isArray(obj.exercise_slides) &&
    obj.exercise_slides.every((e: any) => isCmsPageExerciseSlide(e) as boolean) &&
    Array.isArray(obj.exercise_tasks) &&
    obj.exercise_tasks.every((e: any) => isCmsPageExerciseTask(e) as boolean) &&
    typeof obj.url_path === "string" &&
    typeof obj.title === "string" &&
    (obj.chapter_id === null || typeof obj.chapter_id === "string")
  )
}

export function isContentManagementPage(
  obj: any,
  _argumentName?: string,
): obj is ContentManagementPage {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (isPage(obj.page) as boolean) &&
    Array.isArray(obj.exercises) &&
    obj.exercises.every((e: any) => isCmsPageExercise(e) as boolean) &&
    Array.isArray(obj.exercise_slides) &&
    obj.exercise_slides.every((e: any) => isCmsPageExerciseSlide(e) as boolean) &&
    Array.isArray(obj.exercise_tasks) &&
    obj.exercise_tasks.every((e: any) => isCmsPageExerciseTask(e) as boolean) &&
    typeof obj.organization_id === "string"
  )
}

export function isCoursePageWithUserData(
  obj: any,
  _argumentName?: string,
): obj is CoursePageWithUserData {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (isPage(obj.page) as boolean) &&
    (obj.instance === null || (isCourseInstance(obj.instance) as boolean)) &&
    (obj.settings === null || (isUserCourseSettings(obj.settings) as boolean)) &&
    typeof obj.was_redirected === "boolean"
  )
}

export function isExerciseWithExerciseTasks(
  obj: any,
  _argumentName?: string,
): obj is ExerciseWithExerciseTasks {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date &&
    typeof obj.course_id === "string" &&
    (obj.deleted_at === null || obj.deleted_at instanceof Date) &&
    typeof obj.name === "string" &&
    (obj.deadline === null || obj.deadline instanceof Date) &&
    typeof obj.page_id === "string" &&
    Array.isArray(obj.exercise_tasks) &&
    obj.exercise_tasks.every((e: any) => isExerciseTask(e) as boolean) &&
    typeof obj.score_maximum === "number"
  )
}

export function isHistoryRestoreData(obj: any, _argumentName?: string): obj is HistoryRestoreData {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.history_id === "string"
  )
}

export function isPage(obj: any, _argumentName?: string): obj is Page {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date &&
    (obj.course_id === null || typeof obj.course_id === "string") &&
    (obj.exam_id === null || typeof obj.exam_id === "string") &&
    (obj.chapter_id === null || typeof obj.chapter_id === "string") &&
    typeof obj.url_path === "string" &&
    typeof obj.title === "string" &&
    (obj.deleted_at === null || obj.deleted_at instanceof Date) &&
    typeof obj.order_number === "number" &&
    (obj.copied_from === null || typeof obj.copied_from === "string")
  )
}

export function isPageRoutingDataWithChapterStatus(
  obj: any,
  _argumentName?: string,
): obj is PageRoutingDataWithChapterStatus {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.url_path === "string" &&
    typeof obj.title === "string" &&
    typeof obj.chapter_number === "number" &&
    typeof obj.chapter_id === "string" &&
    (obj.chapter_opens_at === null || obj.chapter_opens_at instanceof Date) &&
    (obj.chapter_front_page_id === null || typeof obj.chapter_front_page_id === "string") &&
    (isChapterStatus(obj.chapter_status) as boolean)
  )
}

export function isPageSearchRequest(obj: any, _argumentName?: string): obj is PageSearchRequest {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.query === "string"
  )
}

export function isPageSearchResult(obj: any, _argumentName?: string): obj is PageSearchResult {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    (obj.title_headline === null || typeof obj.title_headline === "string") &&
    (obj.rank === null || typeof obj.rank === "number") &&
    (obj.content_headline === null || typeof obj.content_headline === "string") &&
    typeof obj.url_path === "string"
  )
}

export function isPageWithExercises(obj: any, _argumentName?: string): obj is PageWithExercises {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date &&
    (obj.course_id === null || typeof obj.course_id === "string") &&
    (obj.exam_id === null || typeof obj.exam_id === "string") &&
    (obj.chapter_id === null || typeof obj.chapter_id === "string") &&
    typeof obj.url_path === "string" &&
    typeof obj.title === "string" &&
    (obj.deleted_at === null || obj.deleted_at instanceof Date) &&
    typeof obj.order_number === "number" &&
    (obj.copied_from === null || typeof obj.copied_from === "string") &&
    Array.isArray(obj.exercises) &&
    obj.exercises.every((e: any) => isExercise(e) as boolean)
  )
}

export function isNewPage(obj: any, _argumentName?: string): obj is NewPage {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    Array.isArray(obj.exercises) &&
    obj.exercises.every((e: any) => isCmsPageExercise(e) as boolean) &&
    Array.isArray(obj.exercise_slides) &&
    obj.exercise_slides.every((e: any) => isCmsPageExerciseSlide(e) as boolean) &&
    Array.isArray(obj.exercise_tasks) &&
    obj.exercise_tasks.every((e: any) => isCmsPageExerciseTask(e) as boolean) &&
    typeof obj.url_path === "string" &&
    typeof obj.title === "string" &&
    (obj.course_id === null || typeof obj.course_id === "string") &&
    (obj.exam_id === null || typeof obj.exam_id === "string") &&
    (obj.chapter_id === null || typeof obj.chapter_id === "string") &&
    (obj.front_page_of_chapter_id === null || typeof obj.front_page_of_chapter_id === "string") &&
    (obj.content_search_language === null || typeof obj.content_search_language === "string")
  )
}

export function isPageChapterAndCourseInformation(
  obj: any,
  _argumentName?: string,
): obj is PageChapterAndCourseInformation {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (obj.chapter_name === null || typeof obj.chapter_name === "string") &&
    (obj.chapter_number === null || typeof obj.chapter_number === "number") &&
    (obj.course_name === null || typeof obj.course_name === "string") &&
    (obj.course_slug === null || typeof obj.course_slug === "string") &&
    (obj.chapter_front_page_id === null || typeof obj.chapter_front_page_id === "string") &&
    (obj.chapter_front_page_url_path === null ||
      typeof obj.chapter_front_page_url_path === "string") &&
    typeof obj.organization_slug === "string"
  )
}

export function isPlaygroundExample(obj: any, _argumentName?: string): obj is PlaygroundExample {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date &&
    (obj.deleted_at === null || obj.deleted_at instanceof Date) &&
    typeof obj.name === "string" &&
    typeof obj.url === "string" &&
    typeof obj.width === "number"
  )
}

export function isPlaygroundExampleData(
  obj: any,
  _argumentName?: string,
): obj is PlaygroundExampleData {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.name === "string" &&
    typeof obj.url === "string" &&
    typeof obj.width === "number"
  )
}

export function isBlockProposal(obj: any, _argumentName?: string): obj is BlockProposal {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    typeof obj.block_id === "string" &&
    typeof obj.current_text === "string" &&
    typeof obj.changed_text === "string" &&
    (isProposalStatus(obj.status) as boolean) &&
    (obj.accept_preview === null || typeof obj.accept_preview === "string")
  )
}

export function isBlockProposalAction(
  obj: any,
  _argumentName?: string,
): obj is BlockProposalAction {
  return (
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.tag === "Accept" &&
      typeof obj.data === "string") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.tag === "Reject")
  )
}

export function isBlockProposalInfo(obj: any, _argumentName?: string): obj is BlockProposalInfo {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    (isBlockProposalAction(obj.action) as boolean)
  )
}

export function isNewProposedBlockEdit(
  obj: any,
  _argumentName?: string,
): obj is NewProposedBlockEdit {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.block_id === "string" &&
    typeof obj.block_attribute === "string" &&
    typeof obj.original_text === "string" &&
    typeof obj.changed_text === "string"
  )
}

export function isProposalStatus(obj: any, _argumentName?: string): obj is ProposalStatus {
  return obj === "Pending" || obj === "Accepted" || obj === "Rejected"
}

export function isEditProposalInfo(obj: any, _argumentName?: string): obj is EditProposalInfo {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.page_id === "string" &&
    typeof obj.page_proposal_id === "string" &&
    Array.isArray(obj.block_proposals) &&
    obj.block_proposals.every((e: any) => isBlockProposalInfo(e) as boolean)
  )
}

export function isNewProposedPageEdits(
  obj: any,
  _argumentName?: string,
): obj is NewProposedPageEdits {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.page_id === "string" &&
    Array.isArray(obj.block_edits) &&
    obj.block_edits.every((e: any) => isNewProposedBlockEdit(e) as boolean)
  )
}

export function isPageProposal(obj: any, _argumentName?: string): obj is PageProposal {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    typeof obj.page_id === "string" &&
    (obj.user_id === null || typeof obj.user_id === "string") &&
    typeof obj.pending === "boolean" &&
    obj.created_at instanceof Date &&
    Array.isArray(obj.block_proposals) &&
    obj.block_proposals.every((e: any) => isBlockProposal(e) as boolean) &&
    typeof obj.page_title === "string" &&
    typeof obj.page_url_path === "string"
  )
}

export function isProposalCount(obj: any, _argumentName?: string): obj is ProposalCount {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.pending === "number" &&
    typeof obj.handled === "number"
  )
}

export function isExerciseSlideSubmission(
  obj: any,
  _argumentName?: string,
): obj is ExerciseSlideSubmission {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date &&
    (obj.deleted_at === null || obj.deleted_at instanceof Date) &&
    typeof obj.exercise_slide_id === "string" &&
    (obj.course_id === null || typeof obj.course_id === "string") &&
    (obj.course_instance_id === null || typeof obj.course_instance_id === "string") &&
    (obj.exam_id === null || typeof obj.exam_id === "string") &&
    typeof obj.exercise_id === "string" &&
    typeof obj.user_id === "string"
  )
}

export function isExerciseSlideSubmissionCount(
  obj: any,
  _argumentName?: string,
): obj is ExerciseSlideSubmissionCount {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (obj.date === null || obj.date instanceof Date) &&
    (obj.count === null || typeof obj.count === "number")
  )
}

export function isExerciseSlideSubmissionCountByExercise(
  obj: any,
  _argumentName?: string,
): obj is ExerciseSlideSubmissionCountByExercise {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (obj.exercise_id === null || typeof obj.exercise_id === "string") &&
    (obj.count === null || typeof obj.count === "number") &&
    (obj.exercise_name === null || typeof obj.exercise_name === "string")
  )
}

export function isExerciseSlideSubmissionCountByWeekAndHour(
  obj: any,
  _argumentName?: string,
): obj is ExerciseSlideSubmissionCountByWeekAndHour {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (obj.isodow === null || typeof obj.isodow === "number") &&
    (obj.hour === null || typeof obj.hour === "number") &&
    (obj.count === null || typeof obj.count === "number")
  )
}

export function isStudentExerciseSlideSubmission(
  obj: any,
  _argumentName?: string,
): obj is StudentExerciseSlideSubmission {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.exercise_slide_id === "string" &&
    Array.isArray(obj.exercise_task_submissions) &&
    obj.exercise_task_submissions.every((e: any) => isStudentExerciseTaskSubmission(e) as boolean)
  )
}

export function isStudentExerciseSlideSubmissionResult(
  obj: any,
  _argumentName?: string,
): obj is StudentExerciseSlideSubmissionResult {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (obj.exercise_status === null || (isExerciseStatus(obj.exercise_status) as boolean)) &&
    Array.isArray(obj.exercise_task_submission_results) &&
    obj.exercise_task_submission_results.every(
      (e: any) => isStudentExerciseTaskSubmissionResult(e) as boolean,
    )
  )
}

export function isExerciseTaskGrading(
  obj: any,
  _argumentName?: string,
): obj is ExerciseTaskGrading {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date &&
    typeof obj.exercise_task_submission_id === "string" &&
    (obj.course_id === null || typeof obj.course_id === "string") &&
    (obj.exam_id === null || typeof obj.exam_id === "string") &&
    typeof obj.exercise_id === "string" &&
    typeof obj.exercise_task_id === "string" &&
    typeof obj.grading_priority === "number" &&
    (obj.score_given === null || typeof obj.score_given === "number") &&
    (isGradingProgress(obj.grading_progress) as boolean) &&
    (isUserPointsUpdateStrategy(obj.user_points_update_strategy) as boolean) &&
    (obj.unscaled_score_given === null || typeof obj.unscaled_score_given === "number") &&
    (obj.unscaled_score_maximum === null || typeof obj.unscaled_score_maximum === "number") &&
    (obj.grading_started_at === null || obj.grading_started_at instanceof Date) &&
    (obj.grading_completed_at === null || obj.grading_completed_at instanceof Date) &&
    (obj.feedback_text === null || typeof obj.feedback_text === "string") &&
    (obj.deleted_at === null || obj.deleted_at instanceof Date)
  )
}

export function isExerciseTaskGradingResult(
  obj: any,
  _argumentName?: string,
): obj is ExerciseTaskGradingResult {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (isGradingProgress(obj.grading_progress) as boolean) &&
    typeof obj.score_given === "number" &&
    typeof obj.score_maximum === "number" &&
    (obj.feedback_text === null || typeof obj.feedback_text === "string")
  )
}

export function isUserPointsUpdateStrategy(
  obj: any,
  _argumentName?: string,
): obj is UserPointsUpdateStrategy {
  return obj === "CanAddPointsButCannotRemovePoints" || obj === "CanAddPointsAndCanRemovePoints"
}

export function isExerciseTaskSubmission(
  obj: any,
  _argumentName?: string,
): obj is ExerciseTaskSubmission {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date &&
    (obj.deleted_at === null || obj.deleted_at instanceof Date) &&
    typeof obj.exercise_slide_submission_id === "string" &&
    typeof obj.exercise_task_id === "string" &&
    typeof obj.exercise_slide_id === "string" &&
    (obj.exercise_task_grading_id === null || typeof obj.exercise_task_grading_id === "string")
  )
}

export function isStudentExerciseTaskSubmission(
  obj: any,
  _argumentName?: string,
): obj is StudentExerciseTaskSubmission {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.exercise_task_id === "string"
  )
}

export function isStudentExerciseTaskSubmissionResult(
  obj: any,
  _argumentName?: string,
): obj is StudentExerciseTaskSubmissionResult {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (isExerciseTaskSubmission(obj.submission) as boolean) &&
    (obj.grading === null || (isExerciseTaskGrading(obj.grading) as boolean))
  )
}

export function isSubmissionInfo(obj: any, _argumentName?: string): obj is SubmissionInfo {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (isExerciseTaskSubmission(obj.submission) as boolean) &&
    (isExercise(obj.exercise) as boolean) &&
    (isExerciseTask(obj.exercise_task) as boolean) &&
    (obj.grading === null || (isExerciseTaskGrading(obj.grading) as boolean)) &&
    typeof obj.iframe_path === "string"
  )
}

export function isRoleUser(obj: any, _argumentName?: string): obj is RoleUser {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    (obj.first_name === null || typeof obj.first_name === "string") &&
    (obj.last_name === null || typeof obj.last_name === "string") &&
    typeof obj.email === "string" &&
    (isUserRole(obj.role) as boolean)
  )
}

export function isRoleDomain(obj: any, _argumentName?: string): obj is RoleDomain {
  return (
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.tag === "Global") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.tag === "Organization" &&
      typeof obj.id === "string") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.tag === "Course" &&
      typeof obj.id === "string") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.tag === "CourseInstance" &&
      typeof obj.id === "string") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.tag === "Exam" &&
      typeof obj.id === "string")
  )
}

export function isUserRole(obj: any, _argumentName?: string): obj is UserRole {
  return obj === "Reviewer" || obj === "Assistant" || obj === "Teacher" || obj === "Admin"
}

export function isUserCourseSettings(obj: any, _argumentName?: string): obj is UserCourseSettings {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.user_id === "string" &&
    typeof obj.course_language_group_id === "string" &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date &&
    (obj.deleted_at === null || obj.deleted_at instanceof Date) &&
    typeof obj.current_course_id === "string" &&
    typeof obj.current_course_instance_id === "string"
  )
}

export function isUserCourseInstanceChapterExerciseProgress(
  obj: any,
  _argumentName?: string,
): obj is UserCourseInstanceChapterExerciseProgress {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.exercise_id === "string" &&
    typeof obj.score_given === "number"
  )
}

export function isUserCourseInstanceProgress(
  obj: any,
  _argumentName?: string,
): obj is UserCourseInstanceProgress {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.score_given === "number" &&
    (obj.score_maximum === null || typeof obj.score_maximum === "number") &&
    (obj.total_exercises === null || typeof obj.total_exercises === "number") &&
    (obj.completed_exercises === null || typeof obj.completed_exercises === "number")
  )
}

export function isExerciseUserCounts(obj: any, _argumentName?: string): obj is ExerciseUserCounts {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (obj.exercise_name === null || typeof obj.exercise_name === "string") &&
    (obj.exercise_order_number === null || typeof obj.exercise_order_number === "number") &&
    (obj.page_order_number === null || typeof obj.page_order_number === "number") &&
    (obj.chapter_number === null || typeof obj.chapter_number === "number") &&
    (obj.exercise_id === null || typeof obj.exercise_id === "string") &&
    typeof obj.n_users_attempted === "number" &&
    typeof obj.n_users_with_some_points === "number" &&
    typeof obj.n_users_with_max_points === "number"
  )
}

export function isUser(obj: any, _argumentName?: string): obj is User {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    (obj.first_name === null || typeof obj.first_name === "string") &&
    (obj.last_name === null || typeof obj.last_name === "string") &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date &&
    (obj.deleted_at === null || obj.deleted_at instanceof Date) &&
    (obj.upstream_id === null || typeof obj.upstream_id === "number") &&
    typeof obj.email === "string"
  )
}

export function isChaptersWithStatus(obj: any, _argumentName?: string): obj is ChaptersWithStatus {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.is_previewable === "boolean" &&
    Array.isArray(obj.chapters) &&
    obj.chapters.every((e: any) => isChapterWithStatus(e) as boolean)
  )
}

export function isRoleQuery(obj: any, _argumentName?: string): obj is RoleQuery {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.global === "undefined" || obj.global === false || obj.global === true) &&
    (typeof obj.organization_id === "undefined" || typeof obj.organization_id === "string") &&
    (typeof obj.course_id === "undefined" || typeof obj.course_id === "string") &&
    (typeof obj.course_instance_id === "undefined" || typeof obj.course_instance_id === "string") &&
    (typeof obj.exam_id === "undefined" || typeof obj.exam_id === "string")
  )
}

export function isRoleInfo(obj: any, _argumentName?: string): obj is RoleInfo {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.email === "string" &&
    (isUserRole(obj.role) as boolean) &&
    (isRoleDomain(obj.domain) as boolean)
  )
}

export function isExamData(obj: any, _argumentName?: string): obj is ExamData {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    obj.starts_at instanceof Date &&
    obj.ends_at instanceof Date &&
    typeof obj.ended === "boolean" &&
    typeof obj.time_minutes === "number" &&
    (isExamEnrollmentData(obj.enrollment_data) as boolean)
  )
}

export function isExamEnrollmentData(obj: any, _argumentName?: string): obj is ExamEnrollmentData {
  return (
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.tag === "EnrolledAndStarted" &&
      typeof obj.page_id === "string" &&
      (isPage(obj.page) as boolean) &&
      (isExamEnrollment(obj.enrollment) as boolean)) ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.tag === "NotEnrolled") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.tag === "NotYetStarted") ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.tag === "StudentTimeUp")
  )
}

export function isExamCourseInfo(obj: any, _argumentName?: string): obj is ExamCourseInfo {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.course_id === "string"
  )
}

export function isLogin(obj: any, _argumentName?: string): obj is Login {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.email === "string" &&
    typeof obj.password === "string"
  )
}

export function isUploadResult(obj: any, _argumentName?: string): obj is UploadResult {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.url === "string"
  )
}

export function isExerciseSubmissions(
  obj: any,
  _argumentName?: string,
): obj is ExerciseSubmissions {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    Array.isArray(obj.data) &&
    obj.data.every((e: any) => isExerciseSlideSubmission(e) as boolean) &&
    typeof obj.total_pages === "number"
  )
}

export function isMarkAsRead(obj: any, _argumentName?: string): obj is MarkAsRead {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.read === "boolean"
  )
}

export function isGetFeedbackQuery(obj: any, _argumentName?: string): obj is GetFeedbackQuery {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.read === "boolean" &&
    (typeof obj.page === "undefined" || typeof obj.page === "number") &&
    (typeof obj.limit === "undefined" || typeof obj.limit === "number")
  )
}

export function isGetEditProposalsQuery(
  obj: any,
  _argumentName?: string,
): obj is GetEditProposalsQuery {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.pending === "boolean" &&
    (typeof obj.page === "undefined" || typeof obj.page === "number") &&
    (typeof obj.limit === "undefined" || typeof obj.limit === "number")
  )
}

export function isErrorResponse(obj: any, _argumentName?: string): obj is ErrorResponse {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.title === "string" &&
    typeof obj.message === "string" &&
    (obj.source === null || typeof obj.source === "string") &&
    (obj.data === null || (isErrorData(obj.data) as boolean))
  )
}

export function isErrorData(obj: any, _argumentName?: string): obj is ErrorData {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.block_id === "string"
  )
}

export function isPagination(obj: any, _argumentName?: string): obj is Pagination {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.page === "undefined" || typeof obj.page === "number") &&
    (typeof obj.limit === "undefined" || typeof obj.limit === "number")
  )
}
