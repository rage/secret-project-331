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
  AnswerRequiringAttention,
  AnswerRequiringAttentionWithTasks,
  AnswersRequiringAttention,
  AutomaticCompletionRequirements,
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
  CmsPeerReviewConfig,
  CmsPeerReviewConfiguration,
  CmsPeerReviewQuestion,
  CompletionPolicy,
  CompletionRegistrationLink,
  ContentManagementPage,
  Course,
  CourseBackgroundQuestion,
  CourseBackgroundQuestionAnswer,
  CourseBackgroundQuestionsAndAnswers,
  CourseBackgroundQuestionType,
  CourseBreadcrumbInfo,
  CourseCount,
  CourseExam,
  CourseInstance,
  CourseInstanceCompletionSummary,
  CourseInstanceEnrollment,
  CourseInstanceForm,
  CourseMaterialCourseModule,
  CourseMaterialExercise,
  CourseMaterialExerciseServiceInfo,
  CourseMaterialExerciseSlide,
  CourseMaterialExerciseTask,
  CourseMaterialPeerReviewConfig,
  CourseMaterialPeerReviewData,
  CourseMaterialPeerReviewDataAnswerToReview,
  CourseMaterialPeerReviewDataWithToken,
  CourseMaterialPeerReviewQuestionAnswer,
  CourseMaterialPeerReviewSubmission,
  CourseModule,
  CourseModuleCompletionWithRegistrationInfo,
  CoursePageWithUserData,
  CourseStructure,
  CourseUpdate,
  CreateAccountDetails,
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
  ExerciseAnswersInCourseRequiringAttentionCount,
  ExerciseRepository,
  ExerciseRepositoryStatus,
  ExerciseService,
  ExerciseServiceIframeRenderingInfo,
  ExerciseServiceInfoApi,
  ExerciseServiceNewOrUpdate,
  ExerciseSlide,
  ExerciseSlideSubmission,
  ExerciseSlideSubmissionCount,
  ExerciseSlideSubmissionCountByExercise,
  ExerciseSlideSubmissionCountByWeekAndHour,
  ExerciseSlideSubmissionInfo,
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
  IsChapterFrontPage,
  Login,
  ManualCompletionPreview,
  ManualCompletionPreviewUser,
  MarkAsRead,
  MaterialReference,
  ModifiedModule,
  ModuleUpdates,
  NewChapter,
  NewCourse,
  NewCourseBackgroundQuestionAnswer,
  NewCourseModule,
  NewExam,
  NewExerciseRepository,
  NewFeedback,
  NewMaterialReference,
  NewModule,
  NewPage,
  NewProposedBlockEdit,
  NewProposedPageEdits,
  NewRegrading,
  NewTeacherGradingDecision,
  OEmbedResponse,
  Organization,
  OrgExam,
  Page,
  PageChapterAndCourseInformation,
  PageHistory,
  PageInfo,
  PageNavigationInformation,
  PageProposal,
  PageRoutingData,
  PageSearchRequest,
  PageSearchResult,
  PageWithExercises,
  Pagination,
  PeerReviewAcceptingStrategy,
  PeerReviewAnswer,
  PeerReviewConfig,
  PeerReviewQuestion,
  PeerReviewQuestionAndAnswer,
  PeerReviewQuestionSubmission,
  PeerReviewQuestionType,
  PeerReviewsRecieved,
  PeerReviewWithQuestionsAndAnswers,
  PendingRole,
  PlaygroundExample,
  PlaygroundExampleData,
  PlaygroundViewsMessage,
  PointMap,
  Points,
  ProposalCount,
  ProposalStatus,
  Regrading,
  RegradingInfo,
  RegradingSubmissionInfo,
  RepositoryExercise,
  Resource,
  ReviewingStage,
  RoleDomain,
  RoleInfo,
  RoleQuery,
  RoleUser,
  SaveCourseSettingsPayload,
  SpecRequest,
  StudentExerciseSlideSubmission,
  StudentExerciseSlideSubmissionResult,
  StudentExerciseTaskSubmission,
  StudentExerciseTaskSubmissionResult,
  TeacherDecisionType,
  TeacherGradingDecision,
  TeacherManualCompletion,
  TeacherManualCompletionRequest,
  Term,
  TermUpdate,
  UploadResult,
  User,
  UserCompletionInformation,
  UserCourseInstanceChapterExerciseProgress,
  UserCourseInstanceChapterProgress,
  UserCourseInstanceExerciseServiceVariable,
  UserCourseInstanceProgress,
  UserCourseModuleCompletion,
  UserCourseSettings,
  UserDetail,
  UserExerciseState,
  UserInfo,
  UserModuleCompletionStatus,
  UserPointsUpdateStrategy,
  UserRole,
  UserWithModuleCompletions,
} from "./bindings"

export function isAction(obj: unknown): obj is Action {
  const typedObj = obj as Action
  return (
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "view_material") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "view") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "edit") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "grade") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "teach") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "download") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "duplicate") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "delete_answer") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "edit_role" &&
      (isUserRole(typedObj["variant"]) as boolean)) ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "create_courses_or_exams") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "usually_unacceptable_deletion") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "upload_file")
  )
}

export function isActionOnResource(obj: unknown): obj is ActionOnResource {
  const typedObj = obj as ActionOnResource
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (isAction(typedObj["action"]) as boolean) &&
    (isResource(typedObj["resource"]) as boolean)
  )
}

export function isResource(obj: unknown): obj is Resource {
  const typedObj = obj as Resource
  return (
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "global_permissions") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "chapter" &&
      typeof typedObj["id"] === "string") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "course" &&
      typeof typedObj["id"] === "string") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "course_instance" &&
      typeof typedObj["id"] === "string") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "exam" &&
      typeof typedObj["id"] === "string") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "exercise" &&
      typeof typedObj["id"] === "string") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "exercise_slide_submission" &&
      typeof typedObj["id"] === "string") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "exercise_task" &&
      typeof typedObj["id"] === "string") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "exercise_task_grading" &&
      typeof typedObj["id"] === "string") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "exercise_task_submission" &&
      typeof typedObj["id"] === "string") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "organization" &&
      typeof typedObj["id"] === "string") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "page" &&
      typeof typedObj["id"] === "string") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "study_registry" &&
      typeof typedObj["id"] === "string") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "any_course") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "role") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "user") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "playground_example") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "exercise_service") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "material_reference")
  )
}

export function isErrorData(obj: unknown): obj is ErrorData {
  const typedObj = obj as ErrorData
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["block_id"] === "string"
  )
}

export function isErrorResponse(obj: unknown): obj is ErrorResponse {
  const typedObj = obj as ErrorResponse
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["title"] === "string" &&
    typeof typedObj["message"] === "string" &&
    (typedObj["source"] === null || typeof typedObj["source"] === "string") &&
    (typedObj["data"] === null || (isErrorData(typedObj["data"]) as boolean))
  )
}

export function isSpecRequest(obj: unknown): obj is SpecRequest {
  const typedObj = obj as SpecRequest
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["request_id"] === "string" &&
    (typedObj["upload_url"] === null || typeof typedObj["upload_url"] === "string")
  )
}

export function isChapter(obj: unknown): obj is Chapter {
  const typedObj = obj as Chapter
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    typeof typedObj["name"] === "string" &&
    (typedObj["color"] === null || typeof typedObj["color"] === "string") &&
    typeof typedObj["course_id"] === "string" &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    (typedObj["chapter_image_url"] === null || typeof typedObj["chapter_image_url"] === "string") &&
    typeof typedObj["chapter_number"] === "number" &&
    (typedObj["front_page_id"] === null || typeof typedObj["front_page_id"] === "string") &&
    (typedObj["opens_at"] === null || typedObj["opens_at"] instanceof Date) &&
    (typedObj["deadline"] === null || typedObj["deadline"] instanceof Date) &&
    (typedObj["copied_from"] === null || typeof typedObj["copied_from"] === "string") &&
    typeof typedObj["course_module_id"] === "string"
  )
}

export function isChapterStatus(obj: unknown): obj is ChapterStatus {
  const typedObj = obj as ChapterStatus
  return typedObj === "open" || typedObj === "closed"
}

export function isChapterUpdate(obj: unknown): obj is ChapterUpdate {
  const typedObj = obj as ChapterUpdate
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["name"] === "string" &&
    (typedObj["color"] === null || typeof typedObj["color"] === "string") &&
    (typedObj["front_page_id"] === null || typeof typedObj["front_page_id"] === "string") &&
    (typedObj["deadline"] === null || typedObj["deadline"] instanceof Date) &&
    (typedObj["opens_at"] === null || typedObj["opens_at"] instanceof Date) &&
    (typedObj["course_module_id"] === null || typeof typedObj["course_module_id"] === "string")
  )
}

export function isChapterWithStatus(obj: unknown): obj is ChapterWithStatus {
  const typedObj = obj as ChapterWithStatus
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    typeof typedObj["name"] === "string" &&
    (typedObj["color"] === null || typeof typedObj["color"] === "string") &&
    typeof typedObj["course_id"] === "string" &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    typeof typedObj["chapter_number"] === "number" &&
    (typedObj["front_page_id"] === null || typeof typedObj["front_page_id"] === "string") &&
    (typedObj["opens_at"] === null || typedObj["opens_at"] instanceof Date) &&
    (isChapterStatus(typedObj["status"]) as boolean) &&
    (typedObj["chapter_image_url"] === null || typeof typedObj["chapter_image_url"] === "string") &&
    typeof typedObj["course_module_id"] === "string"
  )
}

export function isDatabaseChapter(obj: unknown): obj is DatabaseChapter {
  const typedObj = obj as DatabaseChapter
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    typeof typedObj["name"] === "string" &&
    (typedObj["color"] === null || typeof typedObj["color"] === "string") &&
    typeof typedObj["course_id"] === "string" &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    (typedObj["chapter_image_path"] === null ||
      typeof typedObj["chapter_image_path"] === "string") &&
    typeof typedObj["chapter_number"] === "number" &&
    (typedObj["front_page_id"] === null || typeof typedObj["front_page_id"] === "string") &&
    (typedObj["opens_at"] === null || typedObj["opens_at"] instanceof Date) &&
    (typedObj["deadline"] === null || typedObj["deadline"] instanceof Date) &&
    (typedObj["copied_from"] === null || typeof typedObj["copied_from"] === "string") &&
    typeof typedObj["course_module_id"] === "string"
  )
}

export function isNewChapter(obj: unknown): obj is NewChapter {
  const typedObj = obj as NewChapter
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["name"] === "string" &&
    (typedObj["color"] === null || typeof typedObj["color"] === "string") &&
    typeof typedObj["course_id"] === "string" &&
    typeof typedObj["chapter_number"] === "number" &&
    (typedObj["front_page_id"] === null || typeof typedObj["front_page_id"] === "string") &&
    (typedObj["opens_at"] === null || typedObj["opens_at"] instanceof Date) &&
    (typedObj["deadline"] === null || typedObj["deadline"] instanceof Date) &&
    (typedObj["course_module_id"] === null || typeof typedObj["course_module_id"] === "string")
  )
}

export function isUserCourseInstanceChapterProgress(
  obj: unknown,
): obj is UserCourseInstanceChapterProgress {
  const typedObj = obj as UserCourseInstanceChapterProgress
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["score_given"] === "number" &&
    typeof typedObj["score_maximum"] === "number" &&
    (typedObj["total_exercises"] === null || typeof typedObj["total_exercises"] === "number") &&
    (typedObj["attempted_exercises"] === null ||
      typeof typedObj["attempted_exercises"] === "number")
  )
}

export function isCourseBackgroundQuestionAnswer(
  obj: unknown,
): obj is CourseBackgroundQuestionAnswer {
  const typedObj = obj as CourseBackgroundQuestionAnswer
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    typeof typedObj["course_background_question_id"] === "string" &&
    (typedObj["answer_value"] === null || typeof typedObj["answer_value"] === "string") &&
    typeof typedObj["user_id"] === "string"
  )
}

export function isNewCourseBackgroundQuestionAnswer(
  obj: unknown,
): obj is NewCourseBackgroundQuestionAnswer {
  const typedObj = obj as NewCourseBackgroundQuestionAnswer
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typedObj["answer_value"] === null || typeof typedObj["answer_value"] === "string") &&
    typeof typedObj["course_background_question_id"] === "string"
  )
}

export function isCourseBackgroundQuestion(obj: unknown): obj is CourseBackgroundQuestion {
  const typedObj = obj as CourseBackgroundQuestion
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    (typedObj["course_instance_id"] === null ||
      typeof typedObj["course_instance_id"] === "string") &&
    typeof typedObj["course_id"] === "string" &&
    typeof typedObj["question_text"] === "string" &&
    (isCourseBackgroundQuestionType(typedObj["question_type"]) as boolean)
  )
}

export function isCourseBackgroundQuestionType(obj: unknown): obj is CourseBackgroundQuestionType {
  const typedObj = obj as CourseBackgroundQuestionType
  return typedObj === "Checkbox" || typedObj === "Text"
}

export function isCourseBackgroundQuestionsAndAnswers(
  obj: unknown,
): obj is CourseBackgroundQuestionsAndAnswers {
  const typedObj = obj as CourseBackgroundQuestionsAndAnswers
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    Array.isArray(typedObj["background_questions"]) &&
    typedObj["background_questions"].every((e: any) => isCourseBackgroundQuestion(e) as boolean) &&
    Array.isArray(typedObj["answers"]) &&
    typedObj["answers"].every((e: any) => isCourseBackgroundQuestionAnswer(e) as boolean)
  )
}

export function isCourseInstanceEnrollment(obj: unknown): obj is CourseInstanceEnrollment {
  const typedObj = obj as CourseInstanceEnrollment
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["user_id"] === "string" &&
    typeof typedObj["course_id"] === "string" &&
    typeof typedObj["course_instance_id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date)
  )
}

export function isChapterScore(obj: unknown): obj is ChapterScore {
  const typedObj = obj as ChapterScore
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    typeof typedObj["name"] === "string" &&
    (typedObj["color"] === null || typeof typedObj["color"] === "string") &&
    typeof typedObj["course_id"] === "string" &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    (typedObj["chapter_image_path"] === null ||
      typeof typedObj["chapter_image_path"] === "string") &&
    typeof typedObj["chapter_number"] === "number" &&
    (typedObj["front_page_id"] === null || typeof typedObj["front_page_id"] === "string") &&
    (typedObj["opens_at"] === null || typedObj["opens_at"] instanceof Date) &&
    (typedObj["deadline"] === null || typedObj["deadline"] instanceof Date) &&
    (typedObj["copied_from"] === null || typeof typedObj["copied_from"] === "string") &&
    typeof typedObj["course_module_id"] === "string" &&
    typeof typedObj["score_given"] === "number" &&
    typeof typedObj["score_total"] === "number"
  )
}

export function isCourseInstance(obj: unknown): obj is CourseInstance {
  const typedObj = obj as CourseInstance
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    typeof typedObj["course_id"] === "string" &&
    (typedObj["starts_at"] === null || typedObj["starts_at"] instanceof Date) &&
    (typedObj["ends_at"] === null || typedObj["ends_at"] instanceof Date) &&
    (typedObj["name"] === null || typeof typedObj["name"] === "string") &&
    (typedObj["description"] === null || typeof typedObj["description"] === "string") &&
    typeof typedObj["teacher_in_charge_name"] === "string" &&
    typeof typedObj["teacher_in_charge_email"] === "string" &&
    (typedObj["support_email"] === null || typeof typedObj["support_email"] === "string")
  )
}

export function isCourseInstanceForm(obj: unknown): obj is CourseInstanceForm {
  const typedObj = obj as CourseInstanceForm
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typedObj["name"] === null || typeof typedObj["name"] === "string") &&
    (typedObj["description"] === null || typeof typedObj["description"] === "string") &&
    typeof typedObj["teacher_in_charge_name"] === "string" &&
    typeof typedObj["teacher_in_charge_email"] === "string" &&
    (typedObj["support_email"] === null || typeof typedObj["support_email"] === "string") &&
    (typedObj["opening_time"] === null || typedObj["opening_time"] instanceof Date) &&
    (typedObj["closing_time"] === null || typedObj["closing_time"] instanceof Date)
  )
}

export function isPointMap(obj: unknown): obj is PointMap {
  const typedObj = obj as PointMap
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    Object.entries<any>(typedObj).every(
      ([key, value]) => typeof value === "number" && typeof key === "string",
    )
  )
}

export function isPoints(obj: unknown): obj is Points {
  const typedObj = obj as Points
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    Array.isArray(typedObj["chapter_points"]) &&
    typedObj["chapter_points"].every((e: any) => isChapterScore(e) as boolean) &&
    Array.isArray(typedObj["users"]) &&
    typedObj["users"].every((e: any) => isUserDetail(e) as boolean) &&
    ((typedObj["user_chapter_points"] !== null &&
      typeof typedObj["user_chapter_points"] === "object") ||
      typeof typedObj["user_chapter_points"] === "function") &&
    Object.entries<any>(typedObj["user_chapter_points"]).every(
      ([key, value]) => (isPointMap(value) as boolean) && typeof key === "string",
    )
  )
}

export function isCourseModuleCompletionWithRegistrationInfo(
  obj: unknown,
): obj is CourseModuleCompletionWithRegistrationInfo {
  const typedObj = obj as CourseModuleCompletionWithRegistrationInfo
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typedObj["completion_registration_attempt_date"] === null ||
      typedObj["completion_registration_attempt_date"] instanceof Date) &&
    typeof typedObj["course_module_id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    (typedObj["grade"] === null || typeof typedObj["grade"] === "number") &&
    typeof typedObj["passed"] === "boolean" &&
    typeof typedObj["prerequisite_modules_completed"] === "boolean" &&
    typeof typedObj["registered"] === "boolean" &&
    typeof typedObj["user_id"] === "string"
  )
}

export function isAutomaticCompletionRequirements(
  obj: unknown,
): obj is AutomaticCompletionRequirements {
  const typedObj = obj as AutomaticCompletionRequirements
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["course_module_id"] === "string" &&
    (typedObj["number_of_exercises_attempted_treshold"] === null ||
      typeof typedObj["number_of_exercises_attempted_treshold"] === "number") &&
    (typedObj["number_of_points_treshold"] === null ||
      typeof typedObj["number_of_points_treshold"] === "number") &&
    typeof typedObj["requires_exam"] === "boolean"
  )
}

export function isCompletionPolicy(obj: unknown): obj is CompletionPolicy {
  const typedObj = obj as CompletionPolicy
  return (
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["policy"] === "automatic" &&
      (isAutomaticCompletionRequirements(typedObj) as boolean)) ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["policy"] === "manual")
  )
}

export function isCourseModule(obj: unknown): obj is CourseModule {
  const typedObj = obj as CourseModule
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    (typedObj["name"] === null || typeof typedObj["name"] === "string") &&
    typeof typedObj["course_id"] === "string" &&
    typeof typedObj["order_number"] === "number" &&
    (typedObj["copied_from"] === null || typeof typedObj["copied_from"] === "string") &&
    (typedObj["uh_course_code"] === null || typeof typedObj["uh_course_code"] === "string") &&
    (isCompletionPolicy(typedObj["completion_policy"]) as boolean) &&
    (typedObj["completion_registration_link_override"] === null ||
      typeof typedObj["completion_registration_link_override"] === "string") &&
    (typedObj["ects_credits"] === null || typeof typedObj["ects_credits"] === "number")
  )
}

export function isModifiedModule(obj: unknown): obj is ModifiedModule {
  const typedObj = obj as ModifiedModule
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    (typedObj["name"] === null || typeof typedObj["name"] === "string") &&
    typeof typedObj["order_number"] === "number" &&
    (typedObj["uh_course_code"] === null || typeof typedObj["uh_course_code"] === "string") &&
    (typedObj["ects_credits"] === null || typeof typedObj["ects_credits"] === "number") &&
    (isCompletionPolicy(typedObj["completion_policy"]) as boolean) &&
    (typedObj["completion_registration_link_override"] === null ||
      typeof typedObj["completion_registration_link_override"] === "string")
  )
}

export function isModuleUpdates(obj: unknown): obj is ModuleUpdates {
  const typedObj = obj as ModuleUpdates
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    Array.isArray(typedObj["new_modules"]) &&
    typedObj["new_modules"].every((e: any) => isNewModule(e) as boolean) &&
    Array.isArray(typedObj["deleted_modules"]) &&
    typedObj["deleted_modules"].every((e: any) => typeof e === "string") &&
    Array.isArray(typedObj["modified_modules"]) &&
    typedObj["modified_modules"].every((e: any) => isModifiedModule(e) as boolean) &&
    Array.isArray(typedObj["moved_chapters"]) &&
    typedObj["moved_chapters"].every(
      (e: any) => Array.isArray(e) && typeof e[0] === "string" && typeof e[1] === "string",
    )
  )
}

export function isNewCourseModule(obj: unknown): obj is NewCourseModule {
  const typedObj = obj as NewCourseModule
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (isCompletionPolicy(typedObj["completion_policy"]) as boolean) &&
    (typedObj["completion_registration_link_override"] === null ||
      typeof typedObj["completion_registration_link_override"] === "string") &&
    typeof typedObj["course_id"] === "string" &&
    (typedObj["ects_credits"] === null || typeof typedObj["ects_credits"] === "number") &&
    (typedObj["name"] === null || typeof typedObj["name"] === "string") &&
    typeof typedObj["order_number"] === "number" &&
    (typedObj["uh_course_code"] === null || typeof typedObj["uh_course_code"] === "string")
  )
}

export function isNewModule(obj: unknown): obj is NewModule {
  const typedObj = obj as NewModule
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["name"] === "string" &&
    typeof typedObj["order_number"] === "number" &&
    Array.isArray(typedObj["chapters"]) &&
    typedObj["chapters"].every((e: any) => typeof e === "string") &&
    (typedObj["uh_course_code"] === null || typeof typedObj["uh_course_code"] === "string") &&
    (typedObj["ects_credits"] === null || typeof typedObj["ects_credits"] === "number") &&
    (isCompletionPolicy(typedObj["completion_policy"]) as boolean) &&
    (typedObj["completion_registration_link_override"] === null ||
      typeof typedObj["completion_registration_link_override"] === "string")
  )
}

export function isCourse(obj: unknown): obj is Course {
  const typedObj = obj as Course
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["slug"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    typeof typedObj["name"] === "string" &&
    (typedObj["description"] === null || typeof typedObj["description"] === "string") &&
    typeof typedObj["organization_id"] === "string" &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    typeof typedObj["language_code"] === "string" &&
    (typedObj["copied_from"] === null || typeof typedObj["copied_from"] === "string") &&
    (typedObj["content_search_language"] === null ||
      typeof typedObj["content_search_language"] === "string") &&
    typeof typedObj["course_language_group_id"] === "string" &&
    typeof typedObj["is_draft"] === "boolean" &&
    typeof typedObj["is_test_mode"] === "boolean" &&
    typeof typedObj["base_module_completion_requires_n_submodule_completions"] === "number"
  )
}

export function isCourseCount(obj: unknown): obj is CourseCount {
  const typedObj = obj as CourseCount
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["count"] === "number"
  )
}

export function isCourseStructure(obj: unknown): obj is CourseStructure {
  const typedObj = obj as CourseStructure
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (isCourse(typedObj["course"]) as boolean) &&
    Array.isArray(typedObj["pages"]) &&
    typedObj["pages"].every((e: any) => isPage(e) as boolean) &&
    Array.isArray(typedObj["chapters"]) &&
    typedObj["chapters"].every((e: any) => isChapter(e) as boolean) &&
    Array.isArray(typedObj["modules"]) &&
    typedObj["modules"].every((e: any) => isCourseModule(e) as boolean)
  )
}

export function isCourseUpdate(obj: unknown): obj is CourseUpdate {
  const typedObj = obj as CourseUpdate
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["name"] === "string" &&
    (typedObj["description"] === null || typeof typedObj["description"] === "string") &&
    typeof typedObj["is_draft"] === "boolean" &&
    typeof typedObj["is_test_mode"] === "boolean"
  )
}

export function isNewCourse(obj: unknown): obj is NewCourse {
  const typedObj = obj as NewCourse
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["name"] === "string" &&
    typeof typedObj["slug"] === "string" &&
    typeof typedObj["organization_id"] === "string" &&
    typeof typedObj["language_code"] === "string" &&
    typeof typedObj["teacher_in_charge_name"] === "string" &&
    typeof typedObj["teacher_in_charge_email"] === "string" &&
    typeof typedObj["description"] === "string" &&
    typeof typedObj["is_draft"] === "boolean" &&
    typeof typedObj["is_test_mode"] === "boolean"
  )
}

export function isCourseBreadcrumbInfo(obj: unknown): obj is CourseBreadcrumbInfo {
  const typedObj = obj as CourseBreadcrumbInfo
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["course_id"] === "string" &&
    typeof typedObj["course_name"] === "string" &&
    typeof typedObj["organization_slug"] === "string" &&
    typeof typedObj["organization_name"] === "string"
  )
}

export function isEmailTemplate(obj: unknown): obj is EmailTemplate {
  const typedObj = obj as EmailTemplate
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    typeof typedObj["name"] === "string" &&
    (typedObj["subject"] === null || typeof typedObj["subject"] === "string") &&
    (typedObj["exercise_completions_threshold"] === null ||
      typeof typedObj["exercise_completions_threshold"] === "number") &&
    (typedObj["points_threshold"] === null || typeof typedObj["points_threshold"] === "number") &&
    typeof typedObj["course_instance_id"] === "string"
  )
}

export function isEmailTemplateNew(obj: unknown): obj is EmailTemplateNew {
  const typedObj = obj as EmailTemplateNew
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["name"] === "string"
  )
}

export function isEmailTemplateUpdate(obj: unknown): obj is EmailTemplateUpdate {
  const typedObj = obj as EmailTemplateUpdate
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["name"] === "string" &&
    typeof typedObj["subject"] === "string" &&
    (typedObj["exercise_completions_threshold"] === null ||
      typeof typedObj["exercise_completions_threshold"] === "number") &&
    (typedObj["points_threshold"] === null || typeof typedObj["points_threshold"] === "number")
  )
}

export function isCourseExam(obj: unknown): obj is CourseExam {
  const typedObj = obj as CourseExam
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["course_id"] === "string" &&
    typeof typedObj["course_name"] === "string" &&
    typeof typedObj["name"] === "string"
  )
}

export function isExam(obj: unknown): obj is Exam {
  const typedObj = obj as Exam
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["name"] === "string" &&
    typeof typedObj["page_id"] === "string" &&
    Array.isArray(typedObj["courses"]) &&
    typedObj["courses"].every((e: any) => isCourse(e) as boolean) &&
    (typedObj["starts_at"] === null || typedObj["starts_at"] instanceof Date) &&
    (typedObj["ends_at"] === null || typedObj["ends_at"] instanceof Date) &&
    typeof typedObj["time_minutes"] === "number" &&
    typeof typedObj["minimum_points_treshold"] === "number"
  )
}

export function isExamEnrollment(obj: unknown): obj is ExamEnrollment {
  const typedObj = obj as ExamEnrollment
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["user_id"] === "string" &&
    typeof typedObj["exam_id"] === "string" &&
    typedObj["started_at"] instanceof Date
  )
}

export function isExamInstructions(obj: unknown): obj is ExamInstructions {
  const typedObj = obj as ExamInstructions
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string"
  )
}

export function isExamInstructionsUpdate(obj: unknown): obj is ExamInstructionsUpdate {
  const typedObj = obj as ExamInstructionsUpdate
  return (typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function"
}

export function isNewExam(obj: unknown): obj is NewExam {
  const typedObj = obj as NewExam
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["name"] === "string" &&
    (typedObj["starts_at"] === null || typedObj["starts_at"] instanceof Date) &&
    (typedObj["ends_at"] === null || typedObj["ends_at"] instanceof Date) &&
    typeof typedObj["time_minutes"] === "number" &&
    typeof typedObj["organization_id"] === "string" &&
    typeof typedObj["minimum_points_treshold"] === "number"
  )
}

export function isOrgExam(obj: unknown): obj is OrgExam {
  const typedObj = obj as OrgExam
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["name"] === "string" &&
    (typedObj["starts_at"] === null || typedObj["starts_at"] instanceof Date) &&
    (typedObj["ends_at"] === null || typedObj["ends_at"] instanceof Date) &&
    typeof typedObj["time_minutes"] === "number" &&
    typeof typedObj["organization_id"] === "string" &&
    typeof typedObj["minimum_points_treshold"] === "number"
  )
}

export function isExerciseRepository(obj: unknown): obj is ExerciseRepository {
  const typedObj = obj as ExerciseRepository
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["url"] === "string" &&
    (typedObj["course_id"] === null || typeof typedObj["course_id"] === "string") &&
    (typedObj["exam_id"] === null || typeof typedObj["exam_id"] === "string") &&
    (isExerciseRepositoryStatus(typedObj["status"]) as boolean) &&
    (typedObj["error_message"] === null || typeof typedObj["error_message"] === "string")
  )
}

export function isExerciseRepositoryStatus(obj: unknown): obj is ExerciseRepositoryStatus {
  const typedObj = obj as ExerciseRepositoryStatus
  return typedObj === "Pending" || typedObj === "Success" || typedObj === "Failure"
}

export function isCourseMaterialExerciseServiceInfo(
  obj: unknown,
): obj is CourseMaterialExerciseServiceInfo {
  const typedObj = obj as CourseMaterialExerciseServiceInfo
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["exercise_iframe_url"] === "string"
  )
}

export function isExerciseServiceInfoApi(obj: unknown): obj is ExerciseServiceInfoApi {
  const typedObj = obj as ExerciseServiceInfoApi
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["service_name"] === "string" &&
    typeof typedObj["user_interface_iframe_path"] === "string" &&
    typeof typedObj["grade_endpoint_path"] === "string" &&
    typeof typedObj["public_spec_endpoint_path"] === "string" &&
    typeof typedObj["model_solution_spec_endpoint_path"] === "string"
  )
}

export function isExerciseService(obj: unknown): obj is ExerciseService {
  const typedObj = obj as ExerciseService
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    typeof typedObj["name"] === "string" &&
    typeof typedObj["slug"] === "string" &&
    typeof typedObj["public_url"] === "string" &&
    (typedObj["internal_url"] === null || typeof typedObj["internal_url"] === "string") &&
    typeof typedObj["max_reprocessing_submissions_at_once"] === "number"
  )
}

export function isExerciseServiceIframeRenderingInfo(
  obj: unknown,
): obj is ExerciseServiceIframeRenderingInfo {
  const typedObj = obj as ExerciseServiceIframeRenderingInfo
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["name"] === "string" &&
    typeof typedObj["slug"] === "string" &&
    typeof typedObj["public_iframe_url"] === "string"
  )
}

export function isExerciseServiceNewOrUpdate(obj: unknown): obj is ExerciseServiceNewOrUpdate {
  const typedObj = obj as ExerciseServiceNewOrUpdate
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["name"] === "string" &&
    typeof typedObj["slug"] === "string" &&
    typeof typedObj["public_url"] === "string" &&
    (typedObj["internal_url"] === null || typeof typedObj["internal_url"] === "string") &&
    typeof typedObj["max_reprocessing_submissions_at_once"] === "number"
  )
}

export function isAnswerRequiringAttention(obj: unknown): obj is AnswerRequiringAttention {
  const typedObj = obj as AnswerRequiringAttention
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["user_id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    (typedObj["course_instance_id"] === null ||
      typeof typedObj["course_instance_id"] === "string") &&
    (isGradingProgress(typedObj["grading_progress"]) as boolean) &&
    (typedObj["score_given"] === null || typeof typedObj["score_given"] === "number") &&
    typeof typedObj["submission_id"] === "string" &&
    typeof typedObj["exercise_id"] === "string"
  )
}

export function isExerciseAnswersInCourseRequiringAttentionCount(
  obj: unknown,
): obj is ExerciseAnswersInCourseRequiringAttentionCount {
  const typedObj = obj as ExerciseAnswersInCourseRequiringAttentionCount
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["name"] === "string" &&
    typeof typedObj["page_id"] === "string" &&
    (typedObj["chapter_id"] === null || typeof typedObj["chapter_id"] === "string") &&
    typeof typedObj["order_number"] === "number" &&
    (typedObj["count"] === null || typeof typedObj["count"] === "number")
  )
}

export function isExerciseSlideSubmission(obj: unknown): obj is ExerciseSlideSubmission {
  const typedObj = obj as ExerciseSlideSubmission
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    typeof typedObj["exercise_slide_id"] === "string" &&
    (typedObj["course_id"] === null || typeof typedObj["course_id"] === "string") &&
    (typedObj["course_instance_id"] === null ||
      typeof typedObj["course_instance_id"] === "string") &&
    (typedObj["exam_id"] === null || typeof typedObj["exam_id"] === "string") &&
    typeof typedObj["exercise_id"] === "string" &&
    typeof typedObj["user_id"] === "string" &&
    (isUserPointsUpdateStrategy(typedObj["user_points_update_strategy"]) as boolean)
  )
}

export function isExerciseSlideSubmissionCount(obj: unknown): obj is ExerciseSlideSubmissionCount {
  const typedObj = obj as ExerciseSlideSubmissionCount
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typedObj["date"] === null || typedObj["date"] instanceof Date) &&
    (typedObj["count"] === null || typeof typedObj["count"] === "number")
  )
}

export function isExerciseSlideSubmissionCountByExercise(
  obj: unknown,
): obj is ExerciseSlideSubmissionCountByExercise {
  const typedObj = obj as ExerciseSlideSubmissionCountByExercise
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["exercise_id"] === "string" &&
    (typedObj["count"] === null || typeof typedObj["count"] === "number") &&
    typeof typedObj["exercise_name"] === "string"
  )
}

export function isExerciseSlideSubmissionCountByWeekAndHour(
  obj: unknown,
): obj is ExerciseSlideSubmissionCountByWeekAndHour {
  const typedObj = obj as ExerciseSlideSubmissionCountByWeekAndHour
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typedObj["isodow"] === null || typeof typedObj["isodow"] === "number") &&
    (typedObj["hour"] === null || typeof typedObj["hour"] === "number") &&
    (typedObj["count"] === null || typeof typedObj["count"] === "number")
  )
}

export function isExerciseSlideSubmissionInfo(obj: unknown): obj is ExerciseSlideSubmissionInfo {
  const typedObj = obj as ExerciseSlideSubmissionInfo
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    Array.isArray(typedObj["tasks"]) &&
    typedObj["tasks"].every((e: any) => isCourseMaterialExerciseTask(e) as boolean) &&
    (isExercise(typedObj["exercise"]) as boolean) &&
    (isExerciseSlideSubmission(typedObj["exercise_slide_submission"]) as boolean)
  )
}

export function isPeerReviewsRecieved(obj: unknown): obj is PeerReviewsRecieved {
  const typedObj = obj as PeerReviewsRecieved
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    Array.isArray(typedObj["peer_review_questions"]) &&
    typedObj["peer_review_questions"].every((e: any) => isPeerReviewQuestion(e) as boolean) &&
    Array.isArray(typedObj["peer_review_question_submissions"]) &&
    typedObj["peer_review_question_submissions"].every(
      (e: any) => isPeerReviewQuestionSubmission(e) as boolean,
    )
  )
}

export function isCourseMaterialExerciseSlide(obj: unknown): obj is CourseMaterialExerciseSlide {
  const typedObj = obj as CourseMaterialExerciseSlide
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    Array.isArray(typedObj["exercise_tasks"]) &&
    typedObj["exercise_tasks"].every((e: any) => isCourseMaterialExerciseTask(e) as boolean)
  )
}

export function isExerciseSlide(obj: unknown): obj is ExerciseSlide {
  const typedObj = obj as ExerciseSlide
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    typeof typedObj["exercise_id"] === "string" &&
    typeof typedObj["order_number"] === "number"
  )
}

export function isExerciseTaskGrading(obj: unknown): obj is ExerciseTaskGrading {
  const typedObj = obj as ExerciseTaskGrading
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    typeof typedObj["exercise_task_submission_id"] === "string" &&
    (typedObj["course_id"] === null || typeof typedObj["course_id"] === "string") &&
    (typedObj["exam_id"] === null || typeof typedObj["exam_id"] === "string") &&
    typeof typedObj["exercise_id"] === "string" &&
    typeof typedObj["exercise_task_id"] === "string" &&
    typeof typedObj["grading_priority"] === "number" &&
    (typedObj["score_given"] === null || typeof typedObj["score_given"] === "number") &&
    (isGradingProgress(typedObj["grading_progress"]) as boolean) &&
    (typedObj["unscaled_score_given"] === null ||
      typeof typedObj["unscaled_score_given"] === "number") &&
    (typedObj["unscaled_score_maximum"] === null ||
      typeof typedObj["unscaled_score_maximum"] === "number") &&
    (typedObj["grading_started_at"] === null || typedObj["grading_started_at"] instanceof Date) &&
    (typedObj["grading_completed_at"] === null ||
      typedObj["grading_completed_at"] instanceof Date) &&
    (typedObj["feedback_text"] === null || typeof typedObj["feedback_text"] === "string") &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date)
  )
}

export function isExerciseTaskGradingResult(obj: unknown): obj is ExerciseTaskGradingResult {
  const typedObj = obj as ExerciseTaskGradingResult
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (isGradingProgress(typedObj["grading_progress"]) as boolean) &&
    typeof typedObj["score_given"] === "number" &&
    typeof typedObj["score_maximum"] === "number" &&
    (typedObj["feedback_text"] === null || typeof typedObj["feedback_text"] === "string") &&
    (typeof typedObj["set_user_variables"] === "undefined" ||
      (((typedObj["set_user_variables"] !== null &&
        typeof typedObj["set_user_variables"] === "object") ||
        typeof typedObj["set_user_variables"] === "function") &&
        Object.entries<any>(typedObj["set_user_variables"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isUserPointsUpdateStrategy(obj: unknown): obj is UserPointsUpdateStrategy {
  const typedObj = obj as UserPointsUpdateStrategy
  return (
    typedObj === "CanAddPointsButCannotRemovePoints" ||
    typedObj === "CanAddPointsAndCanRemovePoints"
  )
}

export function isExerciseTaskSubmission(obj: unknown): obj is ExerciseTaskSubmission {
  const typedObj = obj as ExerciseTaskSubmission
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    typeof typedObj["exercise_slide_submission_id"] === "string" &&
    typeof typedObj["exercise_task_id"] === "string" &&
    typeof typedObj["exercise_slide_id"] === "string" &&
    (typedObj["exercise_task_grading_id"] === null ||
      typeof typedObj["exercise_task_grading_id"] === "string")
  )
}

export function isCourseMaterialExerciseTask(obj: unknown): obj is CourseMaterialExerciseTask {
  const typedObj = obj as CourseMaterialExerciseTask
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["exercise_service_slug"] === "string" &&
    typeof typedObj["exercise_slide_id"] === "string" &&
    (typedObj["exercise_iframe_url"] === null ||
      typeof typedObj["exercise_iframe_url"] === "string") &&
    (typedObj["pseudonumous_user_id"] === null ||
      typeof typedObj["pseudonumous_user_id"] === "string") &&
    (typedObj["previous_submission"] === null ||
      (isExerciseTaskSubmission(typedObj["previous_submission"]) as boolean)) &&
    (typedObj["previous_submission_grading"] === null ||
      (isExerciseTaskGrading(typedObj["previous_submission_grading"]) as boolean)) &&
    typeof typedObj["order_number"] === "number"
  )
}

export function isExerciseTask(obj: unknown): obj is ExerciseTask {
  const typedObj = obj as ExerciseTask
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    typeof typedObj["exercise_slide_id"] === "string" &&
    typeof typedObj["exercise_type"] === "string" &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    (typedObj["copied_from"] === null || typeof typedObj["copied_from"] === "string") &&
    typeof typedObj["order_number"] === "number"
  )
}

export function isActivityProgress(obj: unknown): obj is ActivityProgress {
  const typedObj = obj as ActivityProgress
  return (
    typedObj === "Initialized" ||
    typedObj === "Started" ||
    typedObj === "InProgress" ||
    typedObj === "Submitted" ||
    typedObj === "Completed"
  )
}

export function isCourseMaterialExercise(obj: unknown): obj is CourseMaterialExercise {
  const typedObj = obj as CourseMaterialExercise
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (isExercise(typedObj["exercise"]) as boolean) &&
    typeof typedObj["can_post_submission"] === "boolean" &&
    (isCourseMaterialExerciseSlide(typedObj["current_exercise_slide"]) as boolean) &&
    (typedObj["exercise_status"] === null ||
      (isExerciseStatus(typedObj["exercise_status"]) as boolean)) &&
    ((typedObj["exercise_slide_submission_counts"] !== null &&
      typeof typedObj["exercise_slide_submission_counts"] === "object") ||
      typeof typedObj["exercise_slide_submission_counts"] === "function") &&
    Object.entries<any>(typedObj["exercise_slide_submission_counts"]).every(
      ([key, value]) => typeof value === "number" && typeof key === "string",
    ) &&
    (typedObj["peer_review_config"] === null ||
      (isCourseMaterialPeerReviewConfig(typedObj["peer_review_config"]) as boolean)) &&
    (typedObj["previous_exercise_slide_submission"] === null ||
      (isExerciseSlideSubmission(typedObj["previous_exercise_slide_submission"]) as boolean)) &&
    Array.isArray(typedObj["user_course_instance_exercise_service_variables"]) &&
    typedObj["user_course_instance_exercise_service_variables"].every(
      (e: any) => isUserCourseInstanceExerciseServiceVariable(e) as boolean,
    )
  )
}

export function isExercise(obj: unknown): obj is Exercise {
  const typedObj = obj as Exercise
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    typeof typedObj["name"] === "string" &&
    (typedObj["course_id"] === null || typeof typedObj["course_id"] === "string") &&
    (typedObj["exam_id"] === null || typeof typedObj["exam_id"] === "string") &&
    typeof typedObj["page_id"] === "string" &&
    (typedObj["chapter_id"] === null || typeof typedObj["chapter_id"] === "string") &&
    (typedObj["deadline"] === null || typedObj["deadline"] instanceof Date) &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    typeof typedObj["score_maximum"] === "number" &&
    typeof typedObj["order_number"] === "number" &&
    (typedObj["copied_from"] === null || typeof typedObj["copied_from"] === "string") &&
    (typedObj["max_tries_per_slide"] === null ||
      typeof typedObj["max_tries_per_slide"] === "number") &&
    typeof typedObj["limit_number_of_tries"] === "boolean" &&
    typeof typedObj["needs_peer_review"] === "boolean" &&
    typeof typedObj["use_course_default_peer_review_config"] === "boolean"
  )
}

export function isExerciseStatus(obj: unknown): obj is ExerciseStatus {
  const typedObj = obj as ExerciseStatus
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typedObj["score_given"] === null || typeof typedObj["score_given"] === "number") &&
    (isActivityProgress(typedObj["activity_progress"]) as boolean) &&
    (isGradingProgress(typedObj["grading_progress"]) as boolean) &&
    (isReviewingStage(typedObj["reviewing_stage"]) as boolean)
  )
}

export function isGradingProgress(obj: unknown): obj is GradingProgress {
  const typedObj = obj as GradingProgress
  return (
    typedObj === "Pending" ||
    typedObj === "Failed" ||
    typedObj === "NotReady" ||
    typedObj === "PendingManual" ||
    typedObj === "FullyGraded"
  )
}

export function isFeedback(obj: unknown): obj is Feedback {
  const typedObj = obj as Feedback
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    (typedObj["user_id"] === null || typeof typedObj["user_id"] === "string") &&
    typeof typedObj["course_id"] === "string" &&
    (typedObj["page_id"] === null || typeof typedObj["page_id"] === "string") &&
    typeof typedObj["feedback_given"] === "string" &&
    (typedObj["selected_text"] === null || typeof typedObj["selected_text"] === "string") &&
    typeof typedObj["marked_as_read"] === "boolean" &&
    typedObj["created_at"] instanceof Date &&
    Array.isArray(typedObj["blocks"]) &&
    typedObj["blocks"].every((e: any) => isFeedbackBlock(e) as boolean) &&
    typeof typedObj["page_title"] === "string" &&
    typeof typedObj["page_url_path"] === "string"
  )
}

export function isFeedbackBlock(obj: unknown): obj is FeedbackBlock {
  const typedObj = obj as FeedbackBlock
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    (typedObj["text"] === null || typeof typedObj["text"] === "string") &&
    (typedObj["order_number"] === null || typeof typedObj["order_number"] === "number")
  )
}

export function isFeedbackCount(obj: unknown): obj is FeedbackCount {
  const typedObj = obj as FeedbackCount
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["read"] === "number" &&
    typeof typedObj["unread"] === "number"
  )
}

export function isNewFeedback(obj: unknown): obj is NewFeedback {
  const typedObj = obj as NewFeedback
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["feedback_given"] === "string" &&
    (typedObj["selected_text"] === null || typeof typedObj["selected_text"] === "string") &&
    Array.isArray(typedObj["related_blocks"]) &&
    typedObj["related_blocks"].every((e: any) => isFeedbackBlock(e) as boolean) &&
    typeof typedObj["page_id"] === "string"
  )
}

export function isTerm(obj: unknown): obj is Term {
  const typedObj = obj as Term
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["term"] === "string" &&
    typeof typedObj["definition"] === "string"
  )
}

export function isTermUpdate(obj: unknown): obj is TermUpdate {
  const typedObj = obj as TermUpdate
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["term"] === "string" &&
    typeof typedObj["definition"] === "string"
  )
}

export function isAnswerRequiringAttentionWithTasks(
  obj: unknown,
): obj is AnswerRequiringAttentionWithTasks {
  const typedObj = obj as AnswerRequiringAttentionWithTasks
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["user_id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    (isGradingProgress(typedObj["grading_progress"]) as boolean) &&
    (typedObj["score_given"] === null || typeof typedObj["score_given"] === "number") &&
    typeof typedObj["submission_id"] === "string" &&
    typeof typedObj["exercise_id"] === "string" &&
    Array.isArray(typedObj["tasks"]) &&
    typedObj["tasks"].every((e: any) => isCourseMaterialExerciseTask(e) as boolean) &&
    Array.isArray(typedObj["given_peer_reviews"]) &&
    typedObj["given_peer_reviews"].every(
      (e: any) => isPeerReviewWithQuestionsAndAnswers(e) as boolean,
    ) &&
    Array.isArray(typedObj["received_peer_reviews"]) &&
    typedObj["received_peer_reviews"].every(
      (e: any) => isPeerReviewWithQuestionsAndAnswers(e) as boolean,
    )
  )
}

export function isAnswersRequiringAttention(obj: unknown): obj is AnswersRequiringAttention {
  const typedObj = obj as AnswersRequiringAttention
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["exercise_max_points"] === "number" &&
    Array.isArray(typedObj["data"]) &&
    typedObj["data"].every((e: any) => isAnswerRequiringAttentionWithTasks(e) as boolean) &&
    typeof typedObj["total_pages"] === "number"
  )
}

export function isStudentExerciseSlideSubmission(
  obj: unknown,
): obj is StudentExerciseSlideSubmission {
  const typedObj = obj as StudentExerciseSlideSubmission
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["exercise_slide_id"] === "string" &&
    Array.isArray(typedObj["exercise_task_submissions"]) &&
    typedObj["exercise_task_submissions"].every(
      (e: any) => isStudentExerciseTaskSubmission(e) as boolean,
    )
  )
}

export function isStudentExerciseSlideSubmissionResult(
  obj: unknown,
): obj is StudentExerciseSlideSubmissionResult {
  const typedObj = obj as StudentExerciseSlideSubmissionResult
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typedObj["exercise_status"] === null ||
      (isExerciseStatus(typedObj["exercise_status"]) as boolean)) &&
    Array.isArray(typedObj["exercise_task_submission_results"]) &&
    typedObj["exercise_task_submission_results"].every(
      (e: any) => isStudentExerciseTaskSubmissionResult(e) as boolean,
    ) &&
    Array.isArray(typedObj["user_course_instance_exercise_service_variables"]) &&
    typedObj["user_course_instance_exercise_service_variables"].every(
      (e: any) => isUserCourseInstanceExerciseServiceVariable(e) as boolean,
    )
  )
}

export function isStudentExerciseTaskSubmission(
  obj: unknown,
): obj is StudentExerciseTaskSubmission {
  const typedObj = obj as StudentExerciseTaskSubmission
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["exercise_task_id"] === "string"
  )
}

export function isStudentExerciseTaskSubmissionResult(
  obj: unknown,
): obj is StudentExerciseTaskSubmissionResult {
  const typedObj = obj as StudentExerciseTaskSubmissionResult
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (isExerciseTaskSubmission(typedObj["submission"]) as boolean) &&
    (typedObj["grading"] === null || (isExerciseTaskGrading(typedObj["grading"]) as boolean)) &&
    typeof typedObj["exercise_task_exercise_service_slug"] === "string"
  )
}

export function isCourseMaterialPeerReviewData(obj: unknown): obj is CourseMaterialPeerReviewData {
  const typedObj = obj as CourseMaterialPeerReviewData
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typedObj["answer_to_review"] === null ||
      (isCourseMaterialPeerReviewDataAnswerToReview(typedObj["answer_to_review"]) as boolean)) &&
    (isPeerReviewConfig(typedObj["peer_review_config"]) as boolean) &&
    Array.isArray(typedObj["peer_review_questions"]) &&
    typedObj["peer_review_questions"].every((e: any) => isPeerReviewQuestion(e) as boolean) &&
    typeof typedObj["num_peer_reviews_given"] === "number"
  )
}

export function isCourseMaterialPeerReviewDataAnswerToReview(
  obj: unknown,
): obj is CourseMaterialPeerReviewDataAnswerToReview {
  const typedObj = obj as CourseMaterialPeerReviewDataAnswerToReview
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["exercise_slide_submission_id"] === "string" &&
    Array.isArray(typedObj["course_material_exercise_tasks"]) &&
    typedObj["course_material_exercise_tasks"].every(
      (e: any) => isCourseMaterialExerciseTask(e) as boolean,
    )
  )
}

export function isCourseMaterialPeerReviewQuestionAnswer(
  obj: unknown,
): obj is CourseMaterialPeerReviewQuestionAnswer {
  const typedObj = obj as CourseMaterialPeerReviewQuestionAnswer
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["peer_review_question_id"] === "string" &&
    (typedObj["text_data"] === null || typeof typedObj["text_data"] === "string") &&
    (typedObj["number_data"] === null || typeof typedObj["number_data"] === "number")
  )
}

export function isCourseMaterialPeerReviewSubmission(
  obj: unknown,
): obj is CourseMaterialPeerReviewSubmission {
  const typedObj = obj as CourseMaterialPeerReviewSubmission
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["exercise_slide_submission_id"] === "string" &&
    typeof typedObj["peer_review_config_id"] === "string" &&
    Array.isArray(typedObj["peer_review_question_answers"]) &&
    typedObj["peer_review_question_answers"].every(
      (e: any) => isCourseMaterialPeerReviewQuestionAnswer(e) as boolean,
    ) &&
    typeof typedObj["token"] === "string"
  )
}

export function isCompletionRegistrationLink(obj: unknown): obj is CompletionRegistrationLink {
  const typedObj = obj as CompletionRegistrationLink
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["url"] === "string"
  )
}

export function isCourseInstanceCompletionSummary(
  obj: unknown,
): obj is CourseInstanceCompletionSummary {
  const typedObj = obj as CourseInstanceCompletionSummary
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    Array.isArray(typedObj["course_modules"]) &&
    typedObj["course_modules"].every((e: any) => isCourseModule(e) as boolean) &&
    Array.isArray(typedObj["users_with_course_module_completions"]) &&
    typedObj["users_with_course_module_completions"].every(
      (e: any) => isUserWithModuleCompletions(e) as boolean,
    )
  )
}

export function isManualCompletionPreview(obj: unknown): obj is ManualCompletionPreview {
  const typedObj = obj as ManualCompletionPreview
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    Array.isArray(typedObj["already_completed_users"]) &&
    typedObj["already_completed_users"].every(
      (e: any) => isManualCompletionPreviewUser(e) as boolean,
    ) &&
    Array.isArray(typedObj["first_time_completing_users"]) &&
    typedObj["first_time_completing_users"].every(
      (e: any) => isManualCompletionPreviewUser(e) as boolean,
    ) &&
    Array.isArray(typedObj["non_enrolled_users"]) &&
    typedObj["non_enrolled_users"].every((e: any) => isManualCompletionPreviewUser(e) as boolean)
  )
}

export function isManualCompletionPreviewUser(obj: unknown): obj is ManualCompletionPreviewUser {
  const typedObj = obj as ManualCompletionPreviewUser
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["user_id"] === "string" &&
    (typedObj["first_name"] === null || typeof typedObj["first_name"] === "string") &&
    (typedObj["last_name"] === null || typeof typedObj["last_name"] === "string") &&
    (typedObj["grade"] === null || typeof typedObj["grade"] === "number") &&
    typeof typedObj["passed"] === "boolean"
  )
}

export function isTeacherManualCompletion(obj: unknown): obj is TeacherManualCompletion {
  const typedObj = obj as TeacherManualCompletion
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["user_id"] === "string" &&
    (typedObj["grade"] === null || typeof typedObj["grade"] === "number") &&
    (typedObj["completion_date"] === null || typedObj["completion_date"] instanceof Date)
  )
}

export function isTeacherManualCompletionRequest(
  obj: unknown,
): obj is TeacherManualCompletionRequest {
  const typedObj = obj as TeacherManualCompletionRequest
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["course_module_id"] === "string" &&
    Array.isArray(typedObj["new_completions"]) &&
    typedObj["new_completions"].every((e: any) => isTeacherManualCompletion(e) as boolean) &&
    typeof typedObj["skip_duplicate_completions"] === "boolean"
  )
}

export function isUserCompletionInformation(obj: unknown): obj is UserCompletionInformation {
  const typedObj = obj as UserCompletionInformation
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["course_module_completion_id"] === "string" &&
    typeof typedObj["course_name"] === "string" &&
    typeof typedObj["uh_course_code"] === "string" &&
    typeof typedObj["email"] === "string" &&
    (typedObj["ects_credits"] === null || typeof typedObj["ects_credits"] === "number")
  )
}

export function isUserCourseModuleCompletion(obj: unknown): obj is UserCourseModuleCompletion {
  const typedObj = obj as UserCourseModuleCompletion
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["course_module_id"] === "string" &&
    (typedObj["grade"] === null || typeof typedObj["grade"] === "number") &&
    typeof typedObj["passed"] === "boolean"
  )
}

export function isUserModuleCompletionStatus(obj: unknown): obj is UserModuleCompletionStatus {
  const typedObj = obj as UserModuleCompletionStatus
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["completed"] === "boolean" &&
    typeof typedObj["default"] === "boolean" &&
    typeof typedObj["module_id"] === "string" &&
    typeof typedObj["name"] === "string" &&
    typeof typedObj["order_number"] === "number" &&
    typeof typedObj["prerequisite_modules_completed"] === "boolean" &&
    (typedObj["grade"] === null || typeof typedObj["grade"] === "number") &&
    (typedObj["passed"] === null || typedObj["passed"] === false || typedObj["passed"] === true)
  )
}

export function isUserWithModuleCompletions(obj: unknown): obj is UserWithModuleCompletions {
  const typedObj = obj as UserWithModuleCompletions
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    Array.isArray(typedObj["completed_modules"]) &&
    typedObj["completed_modules"].every(
      (e: any) => isCourseModuleCompletionWithRegistrationInfo(e) as boolean,
    ) &&
    typeof typedObj["email"] === "string" &&
    (typedObj["first_name"] === null || typeof typedObj["first_name"] === "string") &&
    (typedObj["last_name"] === null || typeof typedObj["last_name"] === "string") &&
    typeof typedObj["user_id"] === "string"
  )
}

export function isMaterialReference(obj: unknown): obj is MaterialReference {
  const typedObj = obj as MaterialReference
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["course_id"] === "string" &&
    typeof typedObj["citation_key"] === "string" &&
    typeof typedObj["reference"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date)
  )
}

export function isNewMaterialReference(obj: unknown): obj is NewMaterialReference {
  const typedObj = obj as NewMaterialReference
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["citation_key"] === "string" &&
    typeof typedObj["reference"] === "string"
  )
}

export function isOrganization(obj: unknown): obj is Organization {
  const typedObj = obj as Organization
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["slug"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    typeof typedObj["name"] === "string" &&
    (typedObj["description"] === null || typeof typedObj["description"] === "string") &&
    (typedObj["organization_image_url"] === null ||
      typeof typedObj["organization_image_url"] === "string") &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date)
  )
}

export function isHistoryChangeReason(obj: unknown): obj is HistoryChangeReason {
  const typedObj = obj as HistoryChangeReason
  return typedObj === "PageSaved" || typedObj === "HistoryRestored"
}

export function isPageHistory(obj: unknown): obj is PageHistory {
  const typedObj = obj as PageHistory
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typeof typedObj["title"] === "string" &&
    (isHistoryChangeReason(typedObj["history_change_reason"]) as boolean) &&
    (typedObj["restored_from_id"] === null || typeof typedObj["restored_from_id"] === "string") &&
    typeof typedObj["author_user_id"] === "string"
  )
}

export function isCmsPageExercise(obj: unknown): obj is CmsPageExercise {
  const typedObj = obj as CmsPageExercise
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["name"] === "string" &&
    typeof typedObj["order_number"] === "number" &&
    typeof typedObj["score_maximum"] === "number" &&
    (typedObj["max_tries_per_slide"] === null ||
      typeof typedObj["max_tries_per_slide"] === "number") &&
    typeof typedObj["limit_number_of_tries"] === "boolean" &&
    (typedObj["deadline"] === null || typedObj["deadline"] instanceof Date) &&
    typeof typedObj["needs_peer_review"] === "boolean" &&
    (typedObj["peer_review_config"] === null ||
      (isCmsPeerReviewConfig(typedObj["peer_review_config"]) as boolean)) &&
    (typedObj["peer_review_questions"] === null ||
      (Array.isArray(typedObj["peer_review_questions"]) &&
        typedObj["peer_review_questions"].every(
          (e: any) => isCmsPeerReviewQuestion(e) as boolean,
        ))) &&
    typeof typedObj["use_course_default_peer_review_config"] === "boolean"
  )
}

export function isCmsPageExerciseSlide(obj: unknown): obj is CmsPageExerciseSlide {
  const typedObj = obj as CmsPageExerciseSlide
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["exercise_id"] === "string" &&
    typeof typedObj["order_number"] === "number"
  )
}

export function isCmsPageExerciseTask(obj: unknown): obj is CmsPageExerciseTask {
  const typedObj = obj as CmsPageExerciseTask
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["exercise_slide_id"] === "string" &&
    typeof typedObj["exercise_type"] === "string" &&
    typeof typedObj["order_number"] === "number"
  )
}

export function isCmsPageUpdate(obj: unknown): obj is CmsPageUpdate {
  const typedObj = obj as CmsPageUpdate
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    Array.isArray(typedObj["exercises"]) &&
    typedObj["exercises"].every((e: any) => isCmsPageExercise(e) as boolean) &&
    Array.isArray(typedObj["exercise_slides"]) &&
    typedObj["exercise_slides"].every((e: any) => isCmsPageExerciseSlide(e) as boolean) &&
    Array.isArray(typedObj["exercise_tasks"]) &&
    typedObj["exercise_tasks"].every((e: any) => isCmsPageExerciseTask(e) as boolean) &&
    typeof typedObj["url_path"] === "string" &&
    typeof typedObj["title"] === "string" &&
    (typedObj["chapter_id"] === null || typeof typedObj["chapter_id"] === "string")
  )
}

export function isContentManagementPage(obj: unknown): obj is ContentManagementPage {
  const typedObj = obj as ContentManagementPage
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (isPage(typedObj["page"]) as boolean) &&
    Array.isArray(typedObj["exercises"]) &&
    typedObj["exercises"].every((e: any) => isCmsPageExercise(e) as boolean) &&
    Array.isArray(typedObj["exercise_slides"]) &&
    typedObj["exercise_slides"].every((e: any) => isCmsPageExerciseSlide(e) as boolean) &&
    Array.isArray(typedObj["exercise_tasks"]) &&
    typedObj["exercise_tasks"].every((e: any) => isCmsPageExerciseTask(e) as boolean) &&
    Array.isArray(typedObj["peer_review_configs"]) &&
    typedObj["peer_review_configs"].every((e: any) => isCmsPeerReviewConfig(e) as boolean) &&
    Array.isArray(typedObj["peer_review_questions"]) &&
    typedObj["peer_review_questions"].every((e: any) => isCmsPeerReviewQuestion(e) as boolean) &&
    typeof typedObj["organization_id"] === "string"
  )
}

export function isCoursePageWithUserData(obj: unknown): obj is CoursePageWithUserData {
  const typedObj = obj as CoursePageWithUserData
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (isPage(typedObj["page"]) as boolean) &&
    (typedObj["instance"] === null || (isCourseInstance(typedObj["instance"]) as boolean)) &&
    (typedObj["settings"] === null || (isUserCourseSettings(typedObj["settings"]) as boolean)) &&
    typeof typedObj["was_redirected"] === "boolean" &&
    typeof typedObj["is_test_mode"] === "boolean"
  )
}

export function isExerciseWithExerciseTasks(obj: unknown): obj is ExerciseWithExerciseTasks {
  const typedObj = obj as ExerciseWithExerciseTasks
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    typeof typedObj["course_id"] === "string" &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    typeof typedObj["name"] === "string" &&
    (typedObj["deadline"] === null || typedObj["deadline"] instanceof Date) &&
    typeof typedObj["page_id"] === "string" &&
    Array.isArray(typedObj["exercise_tasks"]) &&
    typedObj["exercise_tasks"].every((e: any) => isExerciseTask(e) as boolean) &&
    typeof typedObj["score_maximum"] === "number"
  )
}

export function isHistoryRestoreData(obj: unknown): obj is HistoryRestoreData {
  const typedObj = obj as HistoryRestoreData
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["history_id"] === "string"
  )
}

export function isIsChapterFrontPage(obj: unknown): obj is IsChapterFrontPage {
  const typedObj = obj as IsChapterFrontPage
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["is_chapter_front_page"] === "boolean"
  )
}

export function isNewPage(obj: unknown): obj is NewPage {
  const typedObj = obj as NewPage
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    Array.isArray(typedObj["exercises"]) &&
    typedObj["exercises"].every((e: any) => isCmsPageExercise(e) as boolean) &&
    Array.isArray(typedObj["exercise_slides"]) &&
    typedObj["exercise_slides"].every((e: any) => isCmsPageExerciseSlide(e) as boolean) &&
    Array.isArray(typedObj["exercise_tasks"]) &&
    typedObj["exercise_tasks"].every((e: any) => isCmsPageExerciseTask(e) as boolean) &&
    typeof typedObj["url_path"] === "string" &&
    typeof typedObj["title"] === "string" &&
    (typedObj["course_id"] === null || typeof typedObj["course_id"] === "string") &&
    (typedObj["exam_id"] === null || typeof typedObj["exam_id"] === "string") &&
    (typedObj["chapter_id"] === null || typeof typedObj["chapter_id"] === "string") &&
    (typedObj["front_page_of_chapter_id"] === null ||
      typeof typedObj["front_page_of_chapter_id"] === "string") &&
    (typedObj["content_search_language"] === null ||
      typeof typedObj["content_search_language"] === "string")
  )
}

export function isPage(obj: unknown): obj is Page {
  const typedObj = obj as Page
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["course_id"] === null || typeof typedObj["course_id"] === "string") &&
    (typedObj["exam_id"] === null || typeof typedObj["exam_id"] === "string") &&
    (typedObj["chapter_id"] === null || typeof typedObj["chapter_id"] === "string") &&
    typeof typedObj["url_path"] === "string" &&
    (typedObj["page_audio_path"] === null || typeof typedObj["page_audio_path"] === "string") &&
    typeof typedObj["title"] === "string" &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    typeof typedObj["order_number"] === "number" &&
    (typedObj["copied_from"] === null || typeof typedObj["copied_from"] === "string") &&
    typeof typedObj["hidden"] === "boolean"
  )
}

export function isPageChapterAndCourseInformation(
  obj: unknown,
): obj is PageChapterAndCourseInformation {
  const typedObj = obj as PageChapterAndCourseInformation
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typedObj["chapter_name"] === null || typeof typedObj["chapter_name"] === "string") &&
    (typedObj["chapter_number"] === null || typeof typedObj["chapter_number"] === "number") &&
    (typedObj["course_name"] === null || typeof typedObj["course_name"] === "string") &&
    (typedObj["course_slug"] === null || typeof typedObj["course_slug"] === "string") &&
    (typedObj["chapter_front_page_id"] === null ||
      typeof typedObj["chapter_front_page_id"] === "string") &&
    (typedObj["chapter_front_page_url_path"] === null ||
      typeof typedObj["chapter_front_page_url_path"] === "string") &&
    typeof typedObj["organization_slug"] === "string"
  )
}

export function isPageInfo(obj: unknown): obj is PageInfo {
  const typedObj = obj as PageInfo
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["page_id"] === "string" &&
    typeof typedObj["page_title"] === "string" &&
    (typedObj["course_id"] === null || typeof typedObj["course_id"] === "string") &&
    (typedObj["course_name"] === null || typeof typedObj["course_name"] === "string") &&
    (typedObj["course_slug"] === null || typeof typedObj["course_slug"] === "string") &&
    (typedObj["organization_slug"] === null || typeof typedObj["organization_slug"] === "string")
  )
}

export function isPageNavigationInformation(obj: unknown): obj is PageNavigationInformation {
  const typedObj = obj as PageNavigationInformation
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typedObj["chapter_front_page"] === null ||
      (isPageRoutingData(typedObj["chapter_front_page"]) as boolean)) &&
    (typedObj["next_page"] === null || (isPageRoutingData(typedObj["next_page"]) as boolean)) &&
    (typedObj["previous_page"] === null ||
      (isPageRoutingData(typedObj["previous_page"]) as boolean))
  )
}

export function isPageRoutingData(obj: unknown): obj is PageRoutingData {
  const typedObj = obj as PageRoutingData
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["url_path"] === "string" &&
    typeof typedObj["title"] === "string" &&
    typeof typedObj["page_id"] === "string" &&
    typeof typedObj["chapter_number"] === "number" &&
    typeof typedObj["chapter_id"] === "string" &&
    (typedObj["chapter_opens_at"] === null || typedObj["chapter_opens_at"] instanceof Date) &&
    (typedObj["chapter_front_page_id"] === null ||
      typeof typedObj["chapter_front_page_id"] === "string")
  )
}

export function isPageSearchRequest(obj: unknown): obj is PageSearchRequest {
  const typedObj = obj as PageSearchRequest
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["query"] === "string"
  )
}

export function isPageSearchResult(obj: unknown): obj is PageSearchResult {
  const typedObj = obj as PageSearchResult
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    (typedObj["title_headline"] === null || typeof typedObj["title_headline"] === "string") &&
    (typedObj["rank"] === null || typeof typedObj["rank"] === "number") &&
    (typedObj["content_headline"] === null || typeof typedObj["content_headline"] === "string") &&
    typeof typedObj["url_path"] === "string"
  )
}

export function isPageWithExercises(obj: unknown): obj is PageWithExercises {
  const typedObj = obj as PageWithExercises
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["course_id"] === null || typeof typedObj["course_id"] === "string") &&
    (typedObj["exam_id"] === null || typeof typedObj["exam_id"] === "string") &&
    (typedObj["chapter_id"] === null || typeof typedObj["chapter_id"] === "string") &&
    typeof typedObj["url_path"] === "string" &&
    typeof typedObj["title"] === "string" &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    typeof typedObj["order_number"] === "number" &&
    (typedObj["copied_from"] === null || typeof typedObj["copied_from"] === "string") &&
    typeof typedObj["hidden"] === "boolean" &&
    Array.isArray(typedObj["exercises"]) &&
    typedObj["exercises"].every((e: any) => isExercise(e) as boolean)
  )
}

export function isCmsPeerReviewConfig(obj: unknown): obj is CmsPeerReviewConfig {
  const typedObj = obj as CmsPeerReviewConfig
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["course_id"] === "string" &&
    (typedObj["exercise_id"] === null || typeof typedObj["exercise_id"] === "string") &&
    typeof typedObj["peer_reviews_to_give"] === "number" &&
    typeof typedObj["peer_reviews_to_receive"] === "number" &&
    typeof typedObj["accepting_threshold"] === "number" &&
    (isPeerReviewAcceptingStrategy(typedObj["accepting_strategy"]) as boolean)
  )
}

export function isCmsPeerReviewConfiguration(obj: unknown): obj is CmsPeerReviewConfiguration {
  const typedObj = obj as CmsPeerReviewConfiguration
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (isCmsPeerReviewConfig(typedObj["peer_review_config"]) as boolean) &&
    Array.isArray(typedObj["peer_review_questions"]) &&
    typedObj["peer_review_questions"].every((e: any) => isCmsPeerReviewQuestion(e) as boolean)
  )
}

export function isCourseMaterialPeerReviewConfig(
  obj: unknown,
): obj is CourseMaterialPeerReviewConfig {
  const typedObj = obj as CourseMaterialPeerReviewConfig
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["course_id"] === "string" &&
    (typedObj["exercise_id"] === null || typeof typedObj["exercise_id"] === "string") &&
    typeof typedObj["peer_reviews_to_give"] === "number" &&
    typeof typedObj["peer_reviews_to_receive"] === "number"
  )
}

export function isPeerReviewAcceptingStrategy(obj: unknown): obj is PeerReviewAcceptingStrategy {
  const typedObj = obj as PeerReviewAcceptingStrategy
  return (
    typedObj === "AutomaticallyAcceptOrRejectByAverage" ||
    typedObj === "AutomaticallyAcceptOrManualReviewByAverage" ||
    typedObj === "ManualReviewEverything"
  )
}

export function isPeerReviewConfig(obj: unknown): obj is PeerReviewConfig {
  const typedObj = obj as PeerReviewConfig
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    typeof typedObj["course_id"] === "string" &&
    (typedObj["exercise_id"] === null || typeof typedObj["exercise_id"] === "string") &&
    typeof typedObj["peer_reviews_to_give"] === "number" &&
    typeof typedObj["peer_reviews_to_receive"] === "number" &&
    typeof typedObj["accepting_threshold"] === "number" &&
    (isPeerReviewAcceptingStrategy(typedObj["accepting_strategy"]) as boolean)
  )
}

export function isPeerReviewAnswer(obj: unknown): obj is PeerReviewAnswer {
  const typedObj = obj as PeerReviewAnswer
  return (
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "no-answer") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "essay" &&
      typeof typedObj["value"] === "string") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["type"] === "scale" &&
      typeof typedObj["value"] === "number")
  )
}

export function isPeerReviewQuestionAndAnswer(obj: unknown): obj is PeerReviewQuestionAndAnswer {
  const typedObj = obj as PeerReviewQuestionAndAnswer
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["peer_review_config_id"] === "string" &&
    typeof typedObj["peer_review_question_id"] === "string" &&
    typeof typedObj["peer_review_submission_id"] === "string" &&
    typeof typedObj["peer_review_question_submission_id"] === "string" &&
    typeof typedObj["order_number"] === "number" &&
    typeof typedObj["question"] === "string" &&
    (isPeerReviewAnswer(typedObj["answer"]) as boolean) &&
    typeof typedObj["answer_required"] === "boolean"
  )
}

export function isPeerReviewQuestionSubmission(obj: unknown): obj is PeerReviewQuestionSubmission {
  const typedObj = obj as PeerReviewQuestionSubmission
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    typeof typedObj["peer_review_question_id"] === "string" &&
    typeof typedObj["peer_review_submission_id"] === "string" &&
    (typedObj["text_data"] === null || typeof typedObj["text_data"] === "string") &&
    (typedObj["number_data"] === null || typeof typedObj["number_data"] === "number")
  )
}

export function isPeerReviewWithQuestionsAndAnswers(
  obj: unknown,
): obj is PeerReviewWithQuestionsAndAnswers {
  const typedObj = obj as PeerReviewWithQuestionsAndAnswers
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["peer_review_submission_id"] === "string" &&
    Array.isArray(typedObj["questions_and_answers"]) &&
    typedObj["questions_and_answers"].every((e: any) => isPeerReviewQuestionAndAnswer(e) as boolean)
  )
}

export function isCmsPeerReviewQuestion(obj: unknown): obj is CmsPeerReviewQuestion {
  const typedObj = obj as CmsPeerReviewQuestion
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["peer_review_config_id"] === "string" &&
    typeof typedObj["order_number"] === "number" &&
    typeof typedObj["question"] === "string" &&
    (isPeerReviewQuestionType(typedObj["question_type"]) as boolean) &&
    typeof typedObj["answer_required"] === "boolean"
  )
}

export function isPeerReviewQuestion(obj: unknown): obj is PeerReviewQuestion {
  const typedObj = obj as PeerReviewQuestion
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    typeof typedObj["peer_review_config_id"] === "string" &&
    typeof typedObj["order_number"] === "number" &&
    typeof typedObj["question"] === "string" &&
    (isPeerReviewQuestionType(typedObj["question_type"]) as boolean) &&
    typeof typedObj["answer_required"] === "boolean"
  )
}

export function isPeerReviewQuestionType(obj: unknown): obj is PeerReviewQuestionType {
  const typedObj = obj as PeerReviewQuestionType
  return typedObj === "Essay" || typedObj === "Scale"
}

export function isPendingRole(obj: unknown): obj is PendingRole {
  const typedObj = obj as PendingRole
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["user_email"] === "string" &&
    (isUserRole(typedObj["role"]) as boolean) &&
    typedObj["expires_at"] instanceof Date
  )
}

export function isPlaygroundExample(obj: unknown): obj is PlaygroundExample {
  const typedObj = obj as PlaygroundExample
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    typeof typedObj["name"] === "string" &&
    typeof typedObj["url"] === "string" &&
    typeof typedObj["width"] === "number"
  )
}

export function isPlaygroundExampleData(obj: unknown): obj is PlaygroundExampleData {
  const typedObj = obj as PlaygroundExampleData
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["name"] === "string" &&
    typeof typedObj["url"] === "string" &&
    typeof typedObj["width"] === "number"
  )
}

export function isBlockProposal(obj: unknown): obj is BlockProposal {
  const typedObj = obj as BlockProposal
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["block_id"] === "string" &&
    typeof typedObj["current_text"] === "string" &&
    typeof typedObj["changed_text"] === "string" &&
    typeof typedObj["original_text"] === "string" &&
    (isProposalStatus(typedObj["status"]) as boolean) &&
    (typedObj["accept_preview"] === null || typeof typedObj["accept_preview"] === "string")
  )
}

export function isBlockProposalAction(obj: unknown): obj is BlockProposalAction {
  const typedObj = obj as BlockProposalAction
  return (
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["tag"] === "Accept" &&
      typeof typedObj["data"] === "string") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["tag"] === "Reject")
  )
}

export function isBlockProposalInfo(obj: unknown): obj is BlockProposalInfo {
  const typedObj = obj as BlockProposalInfo
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    (isBlockProposalAction(typedObj["action"]) as boolean)
  )
}

export function isNewProposedBlockEdit(obj: unknown): obj is NewProposedBlockEdit {
  const typedObj = obj as NewProposedBlockEdit
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["block_id"] === "string" &&
    typeof typedObj["block_attribute"] === "string" &&
    typeof typedObj["original_text"] === "string" &&
    typeof typedObj["changed_text"] === "string"
  )
}

export function isProposalStatus(obj: unknown): obj is ProposalStatus {
  const typedObj = obj as ProposalStatus
  return typedObj === "Pending" || typedObj === "Accepted" || typedObj === "Rejected"
}

export function isEditProposalInfo(obj: unknown): obj is EditProposalInfo {
  const typedObj = obj as EditProposalInfo
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["page_id"] === "string" &&
    typeof typedObj["page_proposal_id"] === "string" &&
    Array.isArray(typedObj["block_proposals"]) &&
    typedObj["block_proposals"].every((e: any) => isBlockProposalInfo(e) as boolean)
  )
}

export function isNewProposedPageEdits(obj: unknown): obj is NewProposedPageEdits {
  const typedObj = obj as NewProposedPageEdits
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["page_id"] === "string" &&
    Array.isArray(typedObj["block_edits"]) &&
    typedObj["block_edits"].every((e: any) => isNewProposedBlockEdit(e) as boolean)
  )
}

export function isPageProposal(obj: unknown): obj is PageProposal {
  const typedObj = obj as PageProposal
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["page_id"] === "string" &&
    (typedObj["user_id"] === null || typeof typedObj["user_id"] === "string") &&
    typeof typedObj["pending"] === "boolean" &&
    typedObj["created_at"] instanceof Date &&
    Array.isArray(typedObj["block_proposals"]) &&
    typedObj["block_proposals"].every((e: any) => isBlockProposal(e) as boolean) &&
    typeof typedObj["page_title"] === "string" &&
    typeof typedObj["page_url_path"] === "string"
  )
}

export function isProposalCount(obj: unknown): obj is ProposalCount {
  const typedObj = obj as ProposalCount
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["pending"] === "number" &&
    typeof typedObj["handled"] === "number"
  )
}

export function isNewRegrading(obj: unknown): obj is NewRegrading {
  const typedObj = obj as NewRegrading
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (isUserPointsUpdateStrategy(typedObj["user_points_update_strategy"]) as boolean) &&
    Array.isArray(typedObj["exercise_task_submission_ids"]) &&
    typedObj["exercise_task_submission_ids"].every((e: any) => typeof e === "string")
  )
}

export function isRegrading(obj: unknown): obj is Regrading {
  const typedObj = obj as Regrading
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["regrading_started_at"] === null ||
      typedObj["regrading_started_at"] instanceof Date) &&
    (typedObj["regrading_completed_at"] === null ||
      typedObj["regrading_completed_at"] instanceof Date) &&
    (isGradingProgress(typedObj["total_grading_progress"]) as boolean) &&
    (isUserPointsUpdateStrategy(typedObj["user_points_update_strategy"]) as boolean) &&
    (typedObj["user_id"] === null || typeof typedObj["user_id"] === "string")
  )
}

export function isRegradingInfo(obj: unknown): obj is RegradingInfo {
  const typedObj = obj as RegradingInfo
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (isRegrading(typedObj["regrading"]) as boolean) &&
    Array.isArray(typedObj["submission_infos"]) &&
    typedObj["submission_infos"].every((e: any) => isRegradingSubmissionInfo(e) as boolean)
  )
}

export function isRegradingSubmissionInfo(obj: unknown): obj is RegradingSubmissionInfo {
  const typedObj = obj as RegradingSubmissionInfo
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["exercise_task_submission_id"] === "string" &&
    (isExerciseTaskGrading(typedObj["grading_before_regrading"]) as boolean) &&
    (typedObj["grading_after_regrading"] === null ||
      (isExerciseTaskGrading(typedObj["grading_after_regrading"]) as boolean))
  )
}

export function isRepositoryExercise(obj: unknown): obj is RepositoryExercise {
  const typedObj = obj as RepositoryExercise
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["repository_id"] === "string" &&
    typeof typedObj["part"] === "string" &&
    typeof typedObj["name"] === "string" &&
    typeof typedObj["repository_url"] === "string" &&
    Array.isArray(typedObj["checksum"]) &&
    typedObj["checksum"].every((e: any) => typeof e === "number") &&
    typeof typedObj["download_url"] === "string"
  )
}

export function isRoleDomain(obj: unknown): obj is RoleDomain {
  const typedObj = obj as RoleDomain
  return (
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["tag"] === "Global") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["tag"] === "Organization" &&
      typeof typedObj["id"] === "string") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["tag"] === "Course" &&
      typeof typedObj["id"] === "string") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["tag"] === "CourseInstance" &&
      typeof typedObj["id"] === "string") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["tag"] === "Exam" &&
      typeof typedObj["id"] === "string")
  )
}

export function isRoleInfo(obj: unknown): obj is RoleInfo {
  const typedObj = obj as RoleInfo
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["email"] === "string" &&
    (isUserRole(typedObj["role"]) as boolean) &&
    (isRoleDomain(typedObj["domain"]) as boolean)
  )
}

export function isRoleUser(obj: unknown): obj is RoleUser {
  const typedObj = obj as RoleUser
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    (typedObj["first_name"] === null || typeof typedObj["first_name"] === "string") &&
    (typedObj["last_name"] === null || typeof typedObj["last_name"] === "string") &&
    typeof typedObj["email"] === "string" &&
    (isUserRole(typedObj["role"]) as boolean)
  )
}

export function isUserRole(obj: unknown): obj is UserRole {
  const typedObj = obj as UserRole
  return (
    typedObj === "Reviewer" ||
    typedObj === "Assistant" ||
    typedObj === "Teacher" ||
    typedObj === "Admin" ||
    typedObj === "CourseOrExamCreator" ||
    typedObj === "MaterialViewer"
  )
}

export function isNewTeacherGradingDecision(obj: unknown): obj is NewTeacherGradingDecision {
  const typedObj = obj as NewTeacherGradingDecision
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["user_exercise_state_id"] === "string" &&
    typeof typedObj["exercise_id"] === "string" &&
    (isTeacherDecisionType(typedObj["action"]) as boolean) &&
    (typedObj["manual_points"] === null || typeof typedObj["manual_points"] === "number")
  )
}

export function isTeacherDecisionType(obj: unknown): obj is TeacherDecisionType {
  const typedObj = obj as TeacherDecisionType
  return (
    typedObj === "FullPoints" ||
    typedObj === "ZeroPoints" ||
    typedObj === "CustomPoints" ||
    typedObj === "SuspectedPlagiarism"
  )
}

export function isTeacherGradingDecision(obj: unknown): obj is TeacherGradingDecision {
  const typedObj = obj as TeacherGradingDecision
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["user_exercise_state_id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    typeof typedObj["score_given"] === "number" &&
    (isTeacherDecisionType(typedObj["teacher_decision"]) as boolean)
  )
}

export function isUserCourseInstanceExerciseServiceVariable(
  obj: unknown,
): obj is UserCourseInstanceExerciseServiceVariable {
  const typedObj = obj as UserCourseInstanceExerciseServiceVariable
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    typeof typedObj["exercise_service_slug"] === "string" &&
    typeof typedObj["user_id"] === "string" &&
    (typedObj["course_instance_id"] === null ||
      typeof typedObj["course_instance_id"] === "string") &&
    (typedObj["exam_id"] === null || typeof typedObj["exam_id"] === "string") &&
    typeof typedObj["variable_key"] === "string"
  )
}

export function isUserCourseSettings(obj: unknown): obj is UserCourseSettings {
  const typedObj = obj as UserCourseSettings
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["user_id"] === "string" &&
    typeof typedObj["course_language_group_id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    typeof typedObj["current_course_id"] === "string" &&
    typeof typedObj["current_course_instance_id"] === "string"
  )
}

export function isUserDetail(obj: unknown): obj is UserDetail {
  const typedObj = obj as UserDetail
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["user_id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    typeof typedObj["email"] === "string" &&
    (typedObj["first_name"] === null || typeof typedObj["first_name"] === "string") &&
    (typedObj["last_name"] === null || typeof typedObj["last_name"] === "string")
  )
}

export function isExerciseUserCounts(obj: unknown): obj is ExerciseUserCounts {
  const typedObj = obj as ExerciseUserCounts
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["exercise_name"] === "string" &&
    typeof typedObj["exercise_order_number"] === "number" &&
    typeof typedObj["page_order_number"] === "number" &&
    typeof typedObj["chapter_number"] === "number" &&
    typeof typedObj["exercise_id"] === "string" &&
    typeof typedObj["n_users_attempted"] === "number" &&
    typeof typedObj["n_users_with_some_points"] === "number" &&
    typeof typedObj["n_users_with_max_points"] === "number"
  )
}

export function isReviewingStage(obj: unknown): obj is ReviewingStage {
  const typedObj = obj as ReviewingStage
  return (
    typedObj === "NotStarted" ||
    typedObj === "PeerReview" ||
    typedObj === "SelfReview" ||
    typedObj === "WaitingForPeerReviews" ||
    typedObj === "WaitingForManualGrading" ||
    typedObj === "ReviewedAndLocked"
  )
}

export function isUserCourseInstanceChapterExerciseProgress(
  obj: unknown,
): obj is UserCourseInstanceChapterExerciseProgress {
  const typedObj = obj as UserCourseInstanceChapterExerciseProgress
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["exercise_id"] === "string" &&
    typeof typedObj["score_given"] === "number"
  )
}

export function isUserCourseInstanceProgress(obj: unknown): obj is UserCourseInstanceProgress {
  const typedObj = obj as UserCourseInstanceProgress
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["course_module_id"] === "string" &&
    typeof typedObj["course_module_name"] === "string" &&
    typeof typedObj["course_module_order_number"] === "number" &&
    typeof typedObj["score_given"] === "number" &&
    (typedObj["score_required"] === null || typeof typedObj["score_required"] === "number") &&
    (typedObj["score_maximum"] === null || typeof typedObj["score_maximum"] === "number") &&
    (typedObj["total_exercises"] === null || typeof typedObj["total_exercises"] === "number") &&
    (typedObj["attempted_exercises"] === null ||
      typeof typedObj["attempted_exercises"] === "number") &&
    (typedObj["attempted_exercises_required"] === null ||
      typeof typedObj["attempted_exercises_required"] === "number")
  )
}

export function isUserExerciseState(obj: unknown): obj is UserExerciseState {
  const typedObj = obj as UserExerciseState
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["user_id"] === "string" &&
    typeof typedObj["exercise_id"] === "string" &&
    (typedObj["course_instance_id"] === null ||
      typeof typedObj["course_instance_id"] === "string") &&
    (typedObj["exam_id"] === null || typeof typedObj["exam_id"] === "string") &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    (typedObj["score_given"] === null || typeof typedObj["score_given"] === "number") &&
    (isGradingProgress(typedObj["grading_progress"]) as boolean) &&
    (isActivityProgress(typedObj["activity_progress"]) as boolean) &&
    (isReviewingStage(typedObj["reviewing_stage"]) as boolean) &&
    (typedObj["selected_exercise_slide_id"] === null ||
      typeof typedObj["selected_exercise_slide_id"] === "string")
  )
}

export function isUser(obj: unknown): obj is User {
  const typedObj = obj as User
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typedObj["created_at"] instanceof Date &&
    typedObj["updated_at"] instanceof Date &&
    (typedObj["deleted_at"] === null || typedObj["deleted_at"] instanceof Date) &&
    (typedObj["upstream_id"] === null || typeof typedObj["upstream_id"] === "number") &&
    (typedObj["email_domain"] === null || typeof typedObj["email_domain"] === "string")
  )
}

export function isUploadResult(obj: unknown): obj is UploadResult {
  const typedObj = obj as UploadResult
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["url"] === "string"
  )
}

export function isCreateAccountDetails(obj: unknown): obj is CreateAccountDetails {
  const typedObj = obj as CreateAccountDetails
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["email"] === "string" &&
    typeof typedObj["first_name"] === "string" &&
    typeof typedObj["last_name"] === "string" &&
    typeof typedObj["language"] === "string" &&
    typeof typedObj["password"] === "string" &&
    typeof typedObj["password_confirmation"] === "string"
  )
}

export function isLogin(obj: unknown): obj is Login {
  const typedObj = obj as Login
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["email"] === "string" &&
    typeof typedObj["password"] === "string"
  )
}

export function isUserInfo(obj: unknown): obj is UserInfo {
  const typedObj = obj as UserInfo
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["user_id"] === "string"
  )
}

export function isSaveCourseSettingsPayload(obj: unknown): obj is SaveCourseSettingsPayload {
  const typedObj = obj as SaveCourseSettingsPayload
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    Array.isArray(typedObj["background_question_answers"]) &&
    typedObj["background_question_answers"].every(
      (e: any) => isNewCourseBackgroundQuestionAnswer(e) as boolean,
    )
  )
}

export function isChaptersWithStatus(obj: unknown): obj is ChaptersWithStatus {
  const typedObj = obj as ChaptersWithStatus
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["is_previewable"] === "boolean" &&
    Array.isArray(typedObj["modules"]) &&
    typedObj["modules"].every((e: any) => isCourseMaterialCourseModule(e) as boolean)
  )
}

export function isCourseMaterialCourseModule(obj: unknown): obj is CourseMaterialCourseModule {
  const typedObj = obj as CourseMaterialCourseModule
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    Array.isArray(typedObj["chapters"]) &&
    typedObj["chapters"].every((e: any) => isChapterWithStatus(e) as boolean) &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["is_default"] === "boolean" &&
    (typedObj["name"] === null || typeof typedObj["name"] === "string") &&
    typeof typedObj["order_number"] === "number"
  )
}

export function isExamData(obj: unknown): obj is ExamData {
  const typedObj = obj as ExamData
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["id"] === "string" &&
    typeof typedObj["name"] === "string" &&
    typedObj["starts_at"] instanceof Date &&
    typedObj["ends_at"] instanceof Date &&
    typeof typedObj["ended"] === "boolean" &&
    typeof typedObj["time_minutes"] === "number" &&
    (isExamEnrollmentData(typedObj["enrollment_data"]) as boolean)
  )
}

export function isExamEnrollmentData(obj: unknown): obj is ExamEnrollmentData {
  const typedObj = obj as ExamEnrollmentData
  return (
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["tag"] === "EnrolledAndStarted" &&
      typeof typedObj["page_id"] === "string" &&
      (isPage(typedObj["page"]) as boolean) &&
      (isExamEnrollment(typedObj["enrollment"]) as boolean)) ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["tag"] === "NotEnrolled" &&
      typeof typedObj["can_enroll"] === "boolean") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["tag"] === "NotYetStarted") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["tag"] === "StudentTimeUp")
  )
}

export function isCourseMaterialPeerReviewDataWithToken(
  obj: unknown,
): obj is CourseMaterialPeerReviewDataWithToken {
  const typedObj = obj as CourseMaterialPeerReviewDataWithToken
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (isCourseMaterialPeerReviewData(typedObj["course_material_peer_review_data"]) as boolean) &&
    (typedObj["token"] === null || typeof typedObj["token"] === "string")
  )
}

export function isGetFeedbackQuery(obj: unknown): obj is GetFeedbackQuery {
  const typedObj = obj as GetFeedbackQuery
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["read"] === "boolean" &&
    (typeof typedObj["page"] === "undefined" || typeof typedObj["page"] === "number") &&
    (typeof typedObj["limit"] === "undefined" || typeof typedObj["limit"] === "number")
  )
}

export function isExamCourseInfo(obj: unknown): obj is ExamCourseInfo {
  const typedObj = obj as ExamCourseInfo
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["course_id"] === "string"
  )
}

export function isNewExerciseRepository(obj: unknown): obj is NewExerciseRepository {
  const typedObj = obj as NewExerciseRepository
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typedObj["course_id"] === null || typeof typedObj["course_id"] === "string") &&
    (typedObj["exam_id"] === null || typeof typedObj["exam_id"] === "string") &&
    typeof typedObj["git_url"] === "string" &&
    (typedObj["deploy_key"] === null || typeof typedObj["deploy_key"] === "string")
  )
}

export function isExerciseSubmissions(obj: unknown): obj is ExerciseSubmissions {
  const typedObj = obj as ExerciseSubmissions
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    Array.isArray(typedObj["data"]) &&
    typedObj["data"].every((e: any) => isExerciseSlideSubmission(e) as boolean) &&
    typeof typedObj["total_pages"] === "number"
  )
}

export function isMarkAsRead(obj: unknown): obj is MarkAsRead {
  const typedObj = obj as MarkAsRead
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["read"] === "boolean"
  )
}

export function isPlaygroundViewsMessage(obj: unknown): obj is PlaygroundViewsMessage {
  const typedObj = obj as PlaygroundViewsMessage
  return (
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["tag"] === "TimedOut") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["tag"] === "Registered" &&
      typeof typedObj["data"] === "string") ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["tag"] === "ExerciseTaskGradingResult" &&
      (isExerciseTaskGradingResult(typedObj["data"]) as boolean))
  )
}

export function isGetEditProposalsQuery(obj: unknown): obj is GetEditProposalsQuery {
  const typedObj = obj as GetEditProposalsQuery
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["pending"] === "boolean" &&
    (typeof typedObj["page"] === "undefined" || typeof typedObj["page"] === "number") &&
    (typeof typedObj["limit"] === "undefined" || typeof typedObj["limit"] === "number")
  )
}

export function isRoleQuery(obj: unknown): obj is RoleQuery {
  const typedObj = obj as RoleQuery
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["global"] === "undefined" ||
      typedObj["global"] === false ||
      typedObj["global"] === true) &&
    (typeof typedObj["organization_id"] === "undefined" ||
      typeof typedObj["organization_id"] === "string") &&
    (typeof typedObj["course_id"] === "undefined" || typeof typedObj["course_id"] === "string") &&
    (typeof typedObj["course_instance_id"] === "undefined" ||
      typeof typedObj["course_instance_id"] === "string") &&
    (typeof typedObj["exam_id"] === "undefined" || typeof typedObj["exam_id"] === "string")
  )
}

export function isPagination(obj: unknown): obj is Pagination {
  const typedObj = obj as Pagination
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["page"] === "undefined" || typeof typedObj["page"] === "number") &&
    (typeof typedObj["limit"] === "undefined" || typeof typedObj["limit"] === "number")
  )
}

export function isOEmbedResponse(obj: unknown): obj is OEmbedResponse {
  const typedObj = obj as OEmbedResponse
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["author_name"] === "string" &&
    typeof typedObj["author_url"] === "string" &&
    typeof typedObj["html"] === "string" &&
    typeof typedObj["provider_name"] === "string" &&
    typeof typedObj["provider_url"] === "string" &&
    typeof typedObj["title"] === "string" &&
    typeof typedObj["version"] === "string"
  )
}
