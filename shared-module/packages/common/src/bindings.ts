export type Action =
  | { type: "view_material" }
  | { type: "view" }
  | { type: "edit" }
  | { type: "grade" }
  | { type: "teach" }
  | { type: "download" }
  | { type: "duplicate" }
  | { type: "delete_answer" }
  | { type: "edit_role"; variant: UserRole }
  | { type: "create_courses_or_exams" }
  | { type: "usually_unacceptable_deletion" }
  | { type: "upload_file" }
  | { type: "view_user_progress_or_details" }
  | { type: "view_internal_course_structure" }
  | { type: "view_stats" }

export interface ActionOnResource {
  action: Action
  resource: Resource
}

export type Resource =
  | { type: "global_permissions" }
  | { type: "chapter"; id: string }
  | { type: "course"; id: string }
  | { type: "course_instance"; id: string }
  | { type: "exam"; id: string }
  | { type: "exercise"; id: string }
  | { type: "exercise_slide_submission"; id: string }
  | { type: "exercise_task"; id: string }
  | { type: "exercise_task_grading"; id: string }
  | { type: "exercise_task_submission"; id: string }
  | { type: "organization"; id: string }
  | { type: "page"; id: string }
  | { type: "study_registry"; id: string }
  | { type: "any_course" }
  | { type: "role" }
  | { type: "user" }
  | { type: "playground_example" }
  | { type: "exercise_service" }
  | { type: "material_reference" }

export type ErrorData = { block_id: string }

export interface ErrorResponse {
  title: string
  message: string
  source: string | null
  data: ErrorData | null
}

export interface SpecRequest {
  request_id: string
  private_spec: unknown | null
  upload_url: string | null
}

export interface Chapter {
  id: string
  created_at: string
  updated_at: string
  name: string
  color: string | null
  course_id: string
  deleted_at: string | null
  chapter_image_url: string | null
  chapter_number: number
  front_page_id: string | null
  opens_at: string | null
  deadline: string | null
  copied_from: string | null
  course_module_id: string
}

export type ChapterStatus = "open" | "closed"

export interface ChapterUpdate {
  name: string
  color: string | null
  front_page_id: string | null
  deadline: string | null
  opens_at: string | null
  course_module_id: string | null
}

export interface ChapterWithStatus {
  id: string
  created_at: string
  updated_at: string
  name: string
  color: string | null
  course_id: string
  deleted_at: string | null
  chapter_number: number
  front_page_id: string | null
  opens_at: string | null
  status: ChapterStatus
  chapter_image_url: string | null
  course_module_id: string
}

export interface DatabaseChapter {
  id: string
  created_at: string
  updated_at: string
  name: string
  color: string | null
  course_id: string
  deleted_at: string | null
  chapter_image_path: string | null
  chapter_number: number
  front_page_id: string | null
  opens_at: string | null
  deadline: string | null
  copied_from: string | null
  course_module_id: string
}

export interface NewChapter {
  name: string
  color: string | null
  course_id: string
  chapter_number: number
  front_page_id: string | null
  opens_at: string | null
  deadline: string | null
  course_module_id: string | null
}

export interface UserCourseInstanceChapterProgress {
  score_given: number
  score_maximum: number
  total_exercises: number | null
  attempted_exercises: number | null
}

export interface CourseBackgroundQuestionAnswer {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  course_background_question_id: string
  answer_value: string | null
  user_id: string
}

export interface NewCourseBackgroundQuestionAnswer {
  answer_value: string | null
  course_background_question_id: string
}

export interface CourseBackgroundQuestion {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  course_instance_id: string | null
  course_id: string
  question_text: string
  question_type: CourseBackgroundQuestionType
}

export type CourseBackgroundQuestionType = "Checkbox" | "Text"

export interface CourseBackgroundQuestionsAndAnswers {
  background_questions: Array<CourseBackgroundQuestion>
  answers: Array<CourseBackgroundQuestionAnswer>
}

export interface CourseInstanceEnrollment {
  user_id: string
  course_id: string
  course_instance_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CourseInstanceEnrollmentsInfo {
  course_instance_enrollments: Array<CourseInstanceEnrollment>
  course_instances: Array<CourseInstance>
  courses: Array<Course>
  user_course_settings: Array<UserCourseSettings>
  course_module_completions: Array<CourseModuleCompletion>
}

export interface ChapterScore {
  id: string
  created_at: string
  updated_at: string
  name: string
  color: string | null
  course_id: string
  deleted_at: string | null
  chapter_image_path: string | null
  chapter_number: number
  front_page_id: string | null
  opens_at: string | null
  deadline: string | null
  copied_from: string | null
  course_module_id: string
  score_given: number
  score_total: number
}

export interface CourseInstance {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  course_id: string
  starts_at: string | null
  ends_at: string | null
  name: string | null
  description: string | null
  teacher_in_charge_name: string
  teacher_in_charge_email: string
  support_email: string | null
}

export interface CourseInstanceForm {
  name: string | null
  description: string | null
  teacher_in_charge_name: string
  teacher_in_charge_email: string
  support_email: string | null
  opening_time: string | null
  closing_time: string | null
}

export type PointMap = Record<string, number>

export interface Points {
  chapter_points: Array<ChapterScore>
  users: Array<UserDetail>
  user_chapter_points: Record<string, PointMap>
}

export interface GeneratedCertificate {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  user_id: string
  name_on_certificate: string
  verification_id: string
  certificate_configuration_id: string
}

export interface CertificateConfiguration {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  certificate_owner_name_y_pos: string
  certificate_owner_name_x_pos: string
  certificate_owner_name_font_size: string
  certificate_owner_name_text_color: string
  certificate_owner_name_text_anchor: CertificateTextAnchor
  certificate_validate_url_y_pos: string
  certificate_validate_url_x_pos: string
  certificate_validate_url_font_size: string
  certificate_validate_url_text_color: string
  certificate_validate_url_text_anchor: CertificateTextAnchor
  certificate_date_y_pos: string
  certificate_date_x_pos: string
  certificate_date_font_size: string
  certificate_date_text_color: string
  certificate_date_text_anchor: CertificateTextAnchor
  certificate_locale: string
  paper_size: PaperSize
  background_svg_path: string
  background_svg_file_upload_id: string
  overlay_svg_path: string | null
  overlay_svg_file_upload_id: string | null
}

export type CertificateTextAnchor = "start" | "middle" | "end"

export type PaperSize = "horizontal-a4" | "vertical-a4"

export interface CourseModuleCompletionWithRegistrationInfo {
  completion_registration_attempt_date: string | null
  course_module_id: string
  created_at: string
  grade: number | null
  passed: boolean
  prerequisite_modules_completed: boolean
  registered: boolean
  user_id: string
  completion_date: string
}

export interface CourseModuleCompletion {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  course_id: string
  course_instance_id: string
  course_module_id: string
  user_id: string
  completion_date: string
  completion_registration_attempt_date: string | null
  completion_language: string
  eligible_for_ects: boolean
  email: string
  grade: number | null
  passed: boolean
  prerequisite_modules_completed: boolean
  completion_granter_user_id: string | null
  needs_to_be_reviewed: boolean | null
}

export interface AutomaticCompletionRequirements {
  course_module_id: string
  number_of_exercises_attempted_treshold: number | null
  number_of_points_treshold: number | null
  requires_exam: boolean
}

export type CompletionPolicy =
  | ({ policy: "automatic" } & AutomaticCompletionRequirements)
  | { policy: "manual" }

export interface CourseModule {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  name: string | null
  course_id: string
  order_number: number
  copied_from: string | null
  uh_course_code: string | null
  completion_policy: CompletionPolicy
  completion_registration_link_override: string | null
  ects_credits: number | null
  enable_registering_completion_to_uh_open_university: boolean
  certification_enabled: boolean
}

export interface ModifiedModule {
  id: string
  name: string | null
  order_number: number
  uh_course_code: string | null
  ects_credits: number | null
  completion_policy: CompletionPolicy
  completion_registration_link_override: string | null
  enable_registering_completion_to_uh_open_university: boolean
}

export interface ModuleUpdates {
  new_modules: Array<NewModule>
  deleted_modules: Array<string>
  modified_modules: Array<ModifiedModule>
  moved_chapters: Array<[string, string]>
}

export interface NewCourseModule {
  completion_policy: CompletionPolicy
  completion_registration_link_override: string | null
  course_id: string
  ects_credits: number | null
  name: string | null
  order_number: number
  uh_course_code: string | null
  enable_registering_completion_to_uh_open_university: boolean
}

export interface NewModule {
  name: string
  order_number: number
  chapters: Array<string>
  uh_course_code: string | null
  ects_credits: number | null
  completion_policy: CompletionPolicy
  completion_registration_link_override: string | null
  enable_registering_completion_to_uh_open_university: boolean
}

export interface Course {
  id: string
  slug: string
  created_at: string
  updated_at: string
  name: string
  description: string | null
  organization_id: string
  deleted_at: string | null
  language_code: string
  copied_from: string | null
  content_search_language: string | null
  course_language_group_id: string
  is_draft: boolean
  is_test_mode: boolean
  is_unlisted: boolean
  base_module_completion_requires_n_submodule_completions: number
}

export interface CourseCount {
  count: number
}

export interface CourseStructure {
  course: Course
  pages: Array<Page>
  chapters: Array<Chapter>
  modules: Array<CourseModule>
}

export interface CourseUpdate {
  name: string
  description: string | null
  is_draft: boolean
  is_test_mode: boolean
  is_unlisted: boolean
}

export interface NewCourse {
  name: string
  slug: string
  organization_id: string
  language_code: string
  teacher_in_charge_name: string
  teacher_in_charge_email: string
  description: string
  is_draft: boolean
  is_test_mode: boolean
  is_unlisted: boolean
  copy_user_permissions: boolean
}

export interface CourseBreadcrumbInfo {
  course_id: string
  course_name: string
  course_slug: string
  organization_slug: string
  organization_name: string
}

export interface CertificateConfigurationAndRequirements {
  certificate_configuration: CertificateConfiguration
  requirements: CertificateAllRequirements
}

export interface CertificateAllRequirements {
  certificate_configuration_id: string
  course_module_ids: Array<string>
  course_instance_ids: Array<string>
}

export interface EmailTemplate {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  content: unknown | null
  name: string
  subject: string | null
  exercise_completions_threshold: number | null
  points_threshold: number | null
  course_instance_id: string
}

export interface EmailTemplateNew {
  name: string
}

export interface EmailTemplateUpdate {
  name: string
  subject: string
  content: unknown
  exercise_completions_threshold: number | null
  points_threshold: number | null
}

export interface CourseExam {
  id: string
  course_id: string
  course_name: string
  name: string
}

export interface Exam {
  id: string
  name: string
  instructions: unknown
  page_id: string
  courses: Array<Course>
  starts_at: string | null
  ends_at: string | null
  time_minutes: number
  minimum_points_treshold: number
  language: string
}

export interface ExamEnrollment {
  user_id: string
  exam_id: string
  started_at: string
  is_teacher_testing: boolean
  show_exercise_answers: boolean | null
}

export interface ExamInstructions {
  id: string
  instructions: unknown
}

export interface ExamInstructionsUpdate {
  instructions: unknown
}

export interface NewExam {
  name: string
  starts_at: string | null
  ends_at: string | null
  time_minutes: number
  organization_id: string
  minimum_points_treshold: number
}

export interface OrgExam {
  id: string
  name: string
  instructions: unknown
  starts_at: string | null
  ends_at: string | null
  time_minutes: number
  organization_id: string
  minimum_points_treshold: number
}

export interface ExerciseRepository {
  id: string
  url: string
  course_id: string | null
  exam_id: string | null
  status: ExerciseRepositoryStatus
  error_message: string | null
}

export type ExerciseRepositoryStatus = "Pending" | "Success" | "Failure"

export interface CourseMaterialExerciseServiceInfo {
  exercise_iframe_url: string
}

export interface ExerciseServiceInfoApi {
  service_name: string
  user_interface_iframe_path: string
  grade_endpoint_path: string
  public_spec_endpoint_path: string
  model_solution_spec_endpoint_path: string
  has_custom_view?: boolean
}

export interface ExerciseService {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  name: string
  slug: string
  public_url: string
  internal_url: string | null
  max_reprocessing_submissions_at_once: number
}

export interface ExerciseServiceIframeRenderingInfo {
  id: string
  name: string
  slug: string
  public_iframe_url: string
  has_custom_view: boolean
}

export interface ExerciseServiceNewOrUpdate {
  name: string
  slug: string
  public_url: string
  internal_url: string | null
  max_reprocessing_submissions_at_once: number
}

export interface AnswerRequiringAttention {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  data_json: unknown | null
  course_instance_id: string | null
  grading_progress: GradingProgress
  score_given: number | null
  submission_id: string
  exercise_id: string
}

export interface ExerciseAnswersInCourseRequiringAttentionCount {
  id: string
  name: string
  page_id: string
  chapter_id: string | null
  order_number: number
  count: number | null
}

export interface ExerciseSlideSubmission {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  exercise_slide_id: string
  course_id: string | null
  course_instance_id: string | null
  exam_id: string | null
  exercise_id: string
  user_id: string
  user_points_update_strategy: UserPointsUpdateStrategy
}

export interface ExerciseSlideSubmissionCount {
  date: string | null
  count: number | null
}

export interface ExerciseSlideSubmissionCountByExercise {
  exercise_id: string
  count: number | null
  exercise_name: string
}

export interface ExerciseSlideSubmissionCountByWeekAndHour {
  isodow: number | null
  hour: number | null
  count: number | null
}

export interface ExerciseSlideSubmissionInfo {
  tasks: Array<CourseMaterialExerciseTask>
  exercise: Exercise
  exercise_slide_submission: ExerciseSlideSubmission
}

export interface PeerOrSelfReviewsReceived {
  peer_or_self_review_questions: Array<PeerOrSelfReviewQuestion>
  peer_or_self_review_question_submissions: Array<PeerOrSelfReviewQuestionSubmission>
  peer_or_self_review_submissions: Array<PeerOrSelfReviewSubmission>
}

export interface CourseMaterialExerciseSlide {
  id: string
  exercise_tasks: Array<CourseMaterialExerciseTask>
}

export interface ExerciseSlide {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  exercise_id: string
  order_number: number
}

export interface ExerciseTaskGrading {
  id: string
  created_at: string
  updated_at: string
  exercise_task_submission_id: string
  course_id: string | null
  exam_id: string | null
  exercise_id: string
  exercise_task_id: string
  grading_priority: number
  score_given: number | null
  grading_progress: GradingProgress
  unscaled_score_given: number | null
  unscaled_score_maximum: number | null
  grading_started_at: string | null
  grading_completed_at: string | null
  feedback_json: unknown | null
  feedback_text: string | null
  deleted_at: string | null
}

export interface ExerciseTaskGradingResult {
  grading_progress: GradingProgress
  score_given: number
  score_maximum: number
  feedback_text: string | null
  feedback_json: unknown | null
  set_user_variables?: Record<string, unknown>
}

export type UserPointsUpdateStrategy =
  | "CanAddPointsButCannotRemovePoints"
  | "CanAddPointsAndCanRemovePoints"

export interface ExerciseTaskSubmission {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  exercise_slide_submission_id: string
  exercise_task_id: string
  exercise_slide_id: string
  data_json: unknown | null
  exercise_task_grading_id: string | null
  metadata: unknown | null
}

export interface CourseMaterialExerciseTask {
  id: string
  exercise_service_slug: string
  exercise_slide_id: string
  exercise_iframe_url: string | null
  pseudonumous_user_id: string | null
  assignment: unknown
  public_spec: unknown | null
  model_solution_spec: unknown | null
  previous_submission: ExerciseTaskSubmission | null
  previous_submission_grading: ExerciseTaskGrading | null
  order_number: number
}

export interface ExerciseTask {
  id: string
  created_at: string
  updated_at: string
  exercise_slide_id: string
  exercise_type: string
  assignment: unknown
  deleted_at: string | null
  public_spec: unknown | null
  private_spec: unknown | null
  model_solution_spec: unknown | null
  copied_from: string | null
  order_number: number
}

export type ActivityProgress = "Initialized" | "Started" | "InProgress" | "Submitted" | "Completed"

export interface CourseMaterialExercise {
  exercise: Exercise
  can_post_submission: boolean
  current_exercise_slide: CourseMaterialExerciseSlide
  exercise_status: ExerciseStatus | null
  exercise_slide_submission_counts: Record<string, number>
  peer_or_self_review_config: CourseMaterialPeerOrSelfReviewConfig | null
  previous_exercise_slide_submission: ExerciseSlideSubmission | null
  user_course_instance_exercise_service_variables: Array<UserCourseInstanceExerciseServiceVariable>
}

export interface Exercise {
  id: string
  created_at: string
  updated_at: string
  name: string
  course_id: string | null
  exam_id: string | null
  page_id: string
  chapter_id: string | null
  deadline: string | null
  deleted_at: string | null
  score_maximum: number
  order_number: number
  copied_from: string | null
  max_tries_per_slide: number | null
  limit_number_of_tries: boolean
  needs_peer_review: boolean
  needs_self_review: boolean
  use_course_default_peer_or_self_review_config: boolean
  exercise_language_group_id: string | null
}

export interface ExerciseStatus {
  score_given: number | null
  activity_progress: ActivityProgress
  grading_progress: GradingProgress
  reviewing_stage: ReviewingStage
}

export interface ExerciseStatusSummaryForUser {
  exercise: Exercise
  user_exercise_state: UserExerciseState | null
  exercise_slide_submissions: Array<ExerciseSlideSubmission>
  given_peer_or_self_review_submissions: Array<PeerOrSelfReviewSubmission>
  given_peer_or_self_review_question_submissions: Array<PeerOrSelfReviewQuestionSubmission>
  received_peer_or_self_review_submissions: Array<PeerOrSelfReviewSubmission>
  received_peer_or_self_review_question_submissions: Array<PeerOrSelfReviewQuestionSubmission>
  peer_review_queue_entry: PeerReviewQueueEntry | null
  teacher_grading_decision: TeacherGradingDecision | null
  peer_or_self_review_questions: Array<PeerOrSelfReviewQuestion>
}

export interface GlobalStatEntry {
  course_name: string
  course_id: string
  organization_id: string
  organization_name: string
  year: string
  value: number
}

export interface GlobalCourseModuleStatEntry {
  course_name: string
  course_id: string
  course_module_id: string
  course_module_name: string | null
  organization_id: string
  organization_name: string
  year: string
  value: number
  course_module_ects_credits: number | null
}

export interface ExerciseGradingStatus {
  exercise_id: string
  exercise_name: string
  score_maximum: number
  score_given: number | null
  teacher_decision: TeacherDecisionType | null
  submission_id: string
  updated_at: string
}

export type GradingProgress = "Failed" | "NotReady" | "PendingManual" | "Pending" | "FullyGraded"

export interface Feedback {
  id: string
  user_id: string | null
  course_id: string
  page_id: string | null
  feedback_given: string
  selected_text: string | null
  marked_as_read: boolean
  created_at: string
  blocks: Array<FeedbackBlock>
  page_title: string
  page_url_path: string
}

export interface FeedbackBlock {
  id: string
  text: string | null
  order_number: number | null
}

export interface FeedbackCount {
  read: number
  unread: number
}

export interface NewFeedback {
  feedback_given: string
  selected_text: string | null
  related_blocks: Array<FeedbackBlock>
  page_id: string
}

export interface Term {
  id: string
  term: string
  definition: string
}

export interface TermUpdate {
  term: string
  definition: string
}

export interface AnswerRequiringAttentionWithTasks {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  data_json: unknown | null
  grading_progress: GradingProgress
  score_given: number | null
  submission_id: string
  exercise_id: string
  tasks: Array<CourseMaterialExerciseTask>
  given_peer_reviews: Array<PeerReviewWithQuestionsAndAnswers>
  received_peer_or_self_reviews: Array<PeerReviewWithQuestionsAndAnswers>
}

export interface AnswersRequiringAttention {
  exercise_max_points: number
  data: Array<AnswerRequiringAttentionWithTasks>
  total_pages: number
}

export interface StudentExerciseSlideSubmission {
  exercise_slide_id: string
  exercise_task_submissions: Array<StudentExerciseTaskSubmission>
}

export interface StudentExerciseSlideSubmissionResult {
  exercise_status: ExerciseStatus | null
  exercise_task_submission_results: Array<StudentExerciseTaskSubmissionResult>
  user_course_instance_exercise_service_variables: Array<UserCourseInstanceExerciseServiceVariable>
}

export interface StudentExerciseTaskSubmission {
  exercise_task_id: string
  data_json: unknown
}

export interface StudentExerciseTaskSubmissionResult {
  submission: ExerciseTaskSubmission
  grading: ExerciseTaskGrading | null
  model_solution_spec: unknown | null
  exercise_task_exercise_service_slug: string
}

export interface CourseMaterialPeerOrSelfReviewData {
  answer_to_review: CourseMaterialPeerOrSelfReviewDataAnswerToReview | null
  peer_or_self_review_config: PeerOrSelfReviewConfig
  peer_or_self_review_questions: Array<PeerOrSelfReviewQuestion>
  num_peer_reviews_given: number
}

export interface CourseMaterialPeerOrSelfReviewDataAnswerToReview {
  exercise_slide_submission_id: string
  course_material_exercise_tasks: Array<CourseMaterialExerciseTask>
}

export interface CourseMaterialPeerOrSelfReviewQuestionAnswer {
  peer_or_self_review_question_id: string
  text_data: string | null
  number_data: number | null
}

export interface CourseMaterialPeerOrSelfReviewSubmission {
  exercise_slide_submission_id: string
  peer_or_self_review_config_id: string
  peer_review_question_answers: Array<CourseMaterialPeerOrSelfReviewQuestionAnswer>
  token: string
}

export interface CompletionRegistrationLink {
  url: string
}

export interface CourseInstanceCompletionSummary {
  course_modules: Array<CourseModule>
  users_with_course_module_completions: Array<UserWithModuleCompletions>
}

export interface CustomViewExerciseSubmissions {
  exercise_tasks: CustomViewExerciseTasks
  exercises: Array<Exercise>
  user_variables: Array<UserCourseInstanceExerciseServiceVariable>
}

export interface CustomViewExerciseTaskGrading {
  id: string
  created_at: string
  exercise_id: string
  exercise_task_id: string
  feedback_json: unknown | null
  feedback_text: string | null
}

export interface CustomViewExerciseTasks {
  exercise_tasks: Array<CustomViewExerciseTaskSpec>
  task_submissions: Array<CustomViewExerciseTaskSubmission>
  task_gradings: Array<CustomViewExerciseTaskGrading>
}

export interface CustomViewExerciseTaskSpec {
  id: string
  public_spec: unknown | null
  order_number: number
}

export interface CustomViewExerciseTaskSubmission {
  id: string
  created_at: string
  exercise_slide_submission_id: string
  exercise_slide_id: string
  exercise_task_id: string
  exercise_task_grading_id: string | null
  data_json: unknown | null
}

export interface ManualCompletionPreview {
  already_completed_users: Array<ManualCompletionPreviewUser>
  first_time_completing_users: Array<ManualCompletionPreviewUser>
  non_enrolled_users: Array<ManualCompletionPreviewUser>
}

export interface ManualCompletionPreviewUser {
  user_id: string
  first_name: string | null
  last_name: string | null
  grade: number | null
  passed: boolean
}

export interface TeacherManualCompletion {
  user_id: string
  grade: number | null
  completion_date: string | null
}

export interface TeacherManualCompletionRequest {
  course_module_id: string
  new_completions: Array<TeacherManualCompletion>
  skip_duplicate_completions: boolean
}

export interface UserCompletionInformation {
  course_module_completion_id: string
  course_name: string
  uh_course_code: string
  email: string
  ects_credits: number | null
  enable_registering_completion_to_uh_open_university: boolean
}

export interface UserCourseModuleCompletion {
  course_module_id: string
  grade: number | null
  passed: boolean
}

export interface UserModuleCompletionStatus {
  completed: boolean
  default: boolean
  module_id: string
  name: string
  order_number: number
  prerequisite_modules_completed: boolean
  grade: number | null
  passed: boolean | null
  enable_registering_completion_to_uh_open_university: boolean
  certification_enabled: boolean
  certificate_configuration_id: string | null
}

export interface UserWithModuleCompletions {
  completed_modules: Array<CourseModuleCompletionWithRegistrationInfo>
  email: string
  first_name: string | null
  last_name: string | null
  user_id: string
}

export interface MaterialReference {
  id: string
  course_id: string
  citation_key: string
  reference: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface NewMaterialReference {
  citation_key: string
  reference: string
}

export interface Organization {
  id: string
  slug: string
  created_at: string
  updated_at: string
  name: string
  description: string | null
  organization_image_url: string | null
  deleted_at: string | null
}

export type HistoryChangeReason = "PageSaved" | "HistoryRestored"

export interface PageHistory {
  id: string
  created_at: string
  title: string
  content: unknown
  history_change_reason: HistoryChangeReason
  restored_from_id: string | null
  author_user_id: string
}

export interface CmsPageExercise {
  id: string
  name: string
  order_number: number
  score_maximum: number
  max_tries_per_slide: number | null
  limit_number_of_tries: boolean
  deadline: string | null
  needs_peer_review: boolean
  needs_self_review: boolean
  peer_or_self_review_config: CmsPeerOrSelfReviewConfig | null
  peer_or_self_review_questions: Array<CmsPeerOrSelfReviewQuestion> | null
  use_course_default_peer_or_self_review_config: boolean
}

export interface CmsPageExerciseSlide {
  id: string
  exercise_id: string
  order_number: number
}

export interface CmsPageExerciseTask {
  id: string
  exercise_slide_id: string
  assignment: unknown
  exercise_type: string
  private_spec: unknown | null
  order_number: number
}

export interface CmsPageUpdate {
  content: unknown
  exercises: Array<CmsPageExercise>
  exercise_slides: Array<CmsPageExerciseSlide>
  exercise_tasks: Array<CmsPageExerciseTask>
  url_path: string
  title: string
  chapter_id: string | null
}

export interface ContentManagementPage {
  page: Page
  exercises: Array<CmsPageExercise>
  exercise_slides: Array<CmsPageExerciseSlide>
  exercise_tasks: Array<CmsPageExerciseTask>
  peer_or_self_review_configs: Array<CmsPeerOrSelfReviewConfig>
  peer_or_self_review_questions: Array<CmsPeerOrSelfReviewQuestion>
  organization_id: string
}

export interface CoursePageWithUserData {
  page: Page
  instance: CourseInstance | null
  settings: UserCourseSettings | null
  was_redirected: boolean
  is_test_mode: boolean
}

export interface ExerciseWithExerciseTasks {
  id: string
  created_at: string
  updated_at: string
  course_id: string
  deleted_at: string | null
  name: string
  deadline: string | null
  page_id: string
  exercise_tasks: Array<ExerciseTask>
  score_maximum: number
}

export interface HistoryRestoreData {
  history_id: string
}

export interface IsChapterFrontPage {
  is_chapter_front_page: boolean
}

export interface NewPage {
  exercises: Array<CmsPageExercise>
  exercise_slides: Array<CmsPageExerciseSlide>
  exercise_tasks: Array<CmsPageExerciseTask>
  content: unknown
  url_path: string
  title: string
  course_id: string | null
  exam_id: string | null
  chapter_id: string | null
  front_page_of_chapter_id: string | null
  content_search_language: string | null
}

export interface Page {
  id: string
  created_at: string
  updated_at: string
  course_id: string | null
  exam_id: string | null
  chapter_id: string | null
  url_path: string
  title: string
  deleted_at: string | null
  content: unknown
  order_number: number
  copied_from: string | null
  hidden: boolean
  page_language_group_id: string | null
}

export interface PageChapterAndCourseInformation {
  chapter_name: string | null
  chapter_number: number | null
  course_name: string | null
  course_slug: string | null
  chapter_front_page_id: string | null
  chapter_front_page_url_path: string | null
  organization_slug: string
}

export interface PageInfo {
  page_id: string
  page_title: string
  course_id: string | null
  course_name: string | null
  course_slug: string | null
  organization_slug: string | null
}

export interface PageNavigationInformation {
  chapter_front_page: PageRoutingData | null
  next_page: PageRoutingData | null
  previous_page: PageRoutingData | null
}

export interface PageRoutingData {
  url_path: string
  title: string
  page_id: string
  chapter_number: number
  chapter_id: string
  chapter_opens_at: string | null
  chapter_front_page_id: string | null
}

export interface SearchRequest {
  query: string
}

export interface PageSearchResult {
  id: string
  title_headline: string | null
  rank: number | null
  content_headline: string | null
  url_path: string
}

export interface PageWithExercises {
  id: string
  created_at: string
  updated_at: string
  course_id: string | null
  exam_id: string | null
  chapter_id: string | null
  url_path: string
  title: string
  deleted_at: string | null
  content: unknown
  order_number: number
  copied_from: string | null
  hidden: boolean
  page_language_group_id: string | null
  exercises: Array<Exercise>
}

export interface PageDetailsUpdate {
  title: string
  url_path: string
}

export interface CmsPeerOrSelfReviewConfig {
  id: string
  course_id: string
  exercise_id: string | null
  peer_reviews_to_give: number
  peer_reviews_to_receive: number
  accepting_threshold: number
  processing_strategy: PeerReviewProcessingStrategy
  points_are_all_or_nothing: boolean
  review_instructions: unknown | null
}

export interface CmsPeerOrSelfReviewConfiguration {
  peer_or_self_review_config: CmsPeerOrSelfReviewConfig
  peer_or_self_review_questions: Array<CmsPeerOrSelfReviewQuestion>
}

export interface CourseMaterialPeerOrSelfReviewConfig {
  id: string
  course_id: string
  exercise_id: string | null
  peer_reviews_to_give: number
  peer_reviews_to_receive: number
}

export type PeerReviewProcessingStrategy =
  | "AutomaticallyGradeByAverage"
  | "AutomaticallyGradeOrManualReviewByAverage"
  | "ManualReviewEverything"

export interface PeerOrSelfReviewConfig {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  course_id: string
  exercise_id: string | null
  peer_reviews_to_give: number
  peer_reviews_to_receive: number
  accepting_threshold: number
  processing_strategy: PeerReviewProcessingStrategy
  manual_review_cutoff_in_days: number
  points_are_all_or_nothing: boolean
  review_instructions: unknown | null
}

export interface PeerOrSelfReviewSubmission {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  user_id: string
  exercise_id: string
  course_instance_id: string
  peer_or_self_review_config_id: string
  exercise_slide_submission_id: string
}

export type PeerOrSelfReviewAnswer =
  | { type: "no-answer" }
  | { type: "essay"; value: string }
  | { type: "scale"; value: number }

export interface PeerOrSelfReviewQuestionAndAnswer {
  peer_or_self_review_config_id: string
  peer_or_self_review_question_id: string
  peer_or_self_review_submission_id: string
  peer_review_question_submission_id: string
  order_number: number
  question: string
  answer: PeerOrSelfReviewAnswer
  answer_required: boolean
}

export interface PeerOrSelfReviewQuestionSubmission {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  peer_or_self_review_question_id: string
  peer_or_self_review_submission_id: string
  text_data: string | null
  number_data: number | null
}

export interface PeerReviewQueueEntry {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  user_id: string
  exercise_id: string
  course_instance_id: string
  receiving_peer_reviews_exercise_slide_submission_id: string
  received_enough_peer_reviews: boolean
  peer_review_priority: number
  removed_from_queue_for_unusual_reason: boolean
}

export interface PeerReviewWithQuestionsAndAnswers {
  peer_or_self_review_submission_id: string
  peer_review_giver_user_id: string
  questions_and_answers: Array<PeerOrSelfReviewQuestionAndAnswer>
}

export interface CmsPeerOrSelfReviewQuestion {
  id: string
  peer_or_self_review_config_id: string
  order_number: number
  question: string
  question_type: PeerOrSelfReviewQuestionType
  answer_required: boolean
  weight: number
}

export interface PeerOrSelfReviewQuestion {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  peer_or_self_review_config_id: string
  order_number: number
  question: string
  question_type: PeerOrSelfReviewQuestionType
  answer_required: boolean
  weight: number
}

export type PeerOrSelfReviewQuestionType = "Essay" | "Scale"

export interface PendingRole {
  id: string
  user_email: string
  role: UserRole
  expires_at: string
}

export interface PlaygroundExample {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  name: string
  url: string
  width: number
  data: unknown
}

export interface PlaygroundExampleData {
  name: string
  url: string
  width: number
  data: unknown
}

export type BlockProposal =
  | ({ type: "edited-block-still-exists" } & EditedBlockStillExistsData)
  | ({ type: "edited-block-no-longer-exists" } & EditedBlockNoLongerExistsData)

export interface EditedBlockStillExistsData {
  id: string
  block_id: string
  current_text: string
  changed_text: string
  original_text: string
  status: ProposalStatus
  accept_preview: string | null
}

export interface EditedBlockNoLongerExistsData {
  id: string
  block_id: string
  changed_text: string
  original_text: string
  status: ProposalStatus
}

export type BlockProposalAction = { tag: "Accept"; data: string } | { tag: "Reject" }

export interface BlockProposalInfo {
  id: string
  action: BlockProposalAction
}

export interface NewProposedBlockEdit {
  block_id: string
  block_attribute: string
  original_text: string
  changed_text: string
}

export type ProposalStatus = "Pending" | "Accepted" | "Rejected"

export interface EditProposalInfo {
  page_id: string
  page_proposal_id: string
  block_proposals: Array<BlockProposalInfo>
}

export interface NewProposedPageEdits {
  page_id: string
  block_edits: Array<NewProposedBlockEdit>
}

export interface PageProposal {
  id: string
  page_id: string
  user_id: string | null
  pending: boolean
  created_at: string
  block_proposals: Array<BlockProposal>
  page_title: string
  page_url_path: string
}

export interface ProposalCount {
  pending: number
  handled: number
}

export interface PageAudioFile {
  id: string
  page_id: string
  created_at: string
  deleted_at: string | null
  path: string
  mime_type: string
}

export interface NewRegrading {
  user_points_update_strategy: UserPointsUpdateStrategy
  ids: Array<string>
  id_type: NewRegradingIdType
}

export interface Regrading {
  id: string
  created_at: string
  updated_at: string
  regrading_started_at: string | null
  regrading_completed_at: string | null
  total_grading_progress: GradingProgress
  user_points_update_strategy: UserPointsUpdateStrategy
  user_id: string | null
}

export interface RegradingInfo {
  regrading: Regrading
  submission_infos: Array<RegradingSubmissionInfo>
}

export interface RegradingSubmissionInfo {
  exercise_task_submission_id: string
  grading_before_regrading: ExerciseTaskGrading
  grading_after_regrading: ExerciseTaskGrading | null
}

export type NewRegradingIdType = "ExerciseTaskSubmissionId" | "ExerciseId"

export interface RepositoryExercise {
  id: string
  repository_id: string
  part: string
  name: string
  repository_url: string
  checksum: Array<number>
  download_url: string
}

export interface NewResearchForm {
  course_id: string
  content: unknown
}

export interface NewResearchFormQuestion {
  question_id: string
  course_id: string
  research_consent_form_id: string
  question: string
}

export interface ResearchFormQuestion {
  id: string
  course_id: string
  research_consent_form_id: string
  question: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ResearchForm {
  id: string
  course_id: string
  content: unknown
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface NewResearchFormQuestionAnswer {
  user_id: string
  research_form_question_id: string
  research_consent: boolean
}

export interface ResearchFormQuestionAnswer {
  id: string
  user_id: string
  course_id: string
  research_form_question_id: string
  research_consent: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type RoleDomain =
  | { tag: "Global" }
  | { tag: "Organization"; id: string }
  | { tag: "Course"; id: string }
  | { tag: "CourseInstance"; id: string }
  | { tag: "Exam"; id: string }

export interface RoleInfo {
  email: string
  role: UserRole
  domain: RoleDomain
}

export interface RoleUser {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  role: UserRole
}

export type UserRole =
  | "Reviewer"
  | "Assistant"
  | "Teacher"
  | "Admin"
  | "CourseOrExamCreator"
  | "MaterialViewer"
  | "TeachingAndLearningServices"
  | "StatsViewer"

export interface StudentCountry {
  id: string
  user_id: string
  course_id: string
  course_instance_id: string
  country_code: string
  created_at: string
  deleted_at: string | null
}

export interface SuspectedCheaters {
  id: string
  user_id: string
  course_id: string
  created_at: string
  deleted_at: string | null
  updated_at: string | null
  total_duration_seconds: number | null
  total_points: number
}

export interface ThresholdData {
  points: number
  duration_seconds: number | null
}

export interface NewTeacherGradingDecision {
  user_exercise_state_id: string
  exercise_id: string
  action: TeacherDecisionType
  manual_points: number | null
}

export type TeacherDecisionType =
  | "FullPoints"
  | "ZeroPoints"
  | "CustomPoints"
  | "SuspectedPlagiarism"

export interface TeacherGradingDecision {
  id: string
  user_exercise_state_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  score_given: number
  teacher_decision: TeacherDecisionType
}

export interface UserCourseInstanceExerciseServiceVariable {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  exercise_service_slug: string
  user_id: string
  course_instance_id: string | null
  exam_id: string | null
  variable_key: string
  variable_value: unknown
}

export interface UserCourseSettings {
  user_id: string
  course_language_group_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  current_course_id: string
  current_course_instance_id: string
}

export interface UserDetail {
  user_id: string
  created_at: string
  updated_at: string
  email: string
  first_name: string | null
  last_name: string | null
  search_helper: string | null
}

export interface ExerciseUserCounts {
  exercise_name: string
  exercise_order_number: number
  page_order_number: number
  chapter_number: number
  exercise_id: string
  n_users_attempted: number
  n_users_with_some_points: number
  n_users_with_max_points: number
}

export type ReviewingStage =
  | "NotStarted"
  | "PeerReview"
  | "SelfReview"
  | "WaitingForPeerReviews"
  | "WaitingForManualGrading"
  | "ReviewedAndLocked"

export interface UserCourseInstanceChapterExerciseProgress {
  exercise_id: string
  score_given: number
}

export interface UserCourseInstanceProgress {
  course_module_id: string
  course_module_name: string
  course_module_order_number: number
  score_given: number
  score_required: number | null
  score_maximum: number | null
  total_exercises: number | null
  attempted_exercises: number | null
  attempted_exercises_required: number | null
}

export interface UserExerciseState {
  id: string
  user_id: string
  exercise_id: string
  course_instance_id: string | null
  exam_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  score_given: number | null
  grading_progress: GradingProgress
  activity_progress: ActivityProgress
  reviewing_stage: ReviewingStage
  selected_exercise_slide_id: string | null
}

export interface UserResearchConsent {
  id: string
  user_id: string
  research_consent: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface User {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  upstream_id: number | null
  email_domain: string | null
}

export interface PageVisitDatumSummaryByCourse {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  course_id: string | null
  exam_id: string | null
  referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  num_visitors: number
  visit_date: string
}

export interface PageVisitDatumSummaryByCourseDeviceTypes {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  browser: string | null
  browser_version: string | null
  operating_system: string | null
  device_type: string | null
  course_id: string | null
  exam_id: string | null
  num_visitors: number
  visit_date: string
}

export interface PageVisitDatumSummaryByPages {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  exam_id: string | null
  course_id: string | null
  page_id: string
  num_visitors: number
  visit_date: string
}

export interface PageVisitDatumSummaryByCoursesCountries {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  country: string | null
  course_id: string | null
  exam_id: string | null
  num_visitors: number
  visit_date: string
}

export interface UploadResult {
  url: string
}

export interface CreateAccountDetails {
  email: string
  first_name: string
  last_name: string
  language: string
  password: string
  password_confirmation: string
}

export interface Login {
  email: string
  password: string
}

export interface UserInfo {
  user_id: string
  first_name: string | null
  last_name: string | null
}

export interface SaveCourseSettingsPayload {
  background_question_answers: Array<NewCourseBackgroundQuestionAnswer>
}

export interface ChaptersWithStatus {
  is_previewable: boolean
  modules: Array<CourseMaterialCourseModule>
}

export interface CourseMaterialCourseModule {
  chapters: Array<ChapterWithStatus>
  id: string
  is_default: boolean
  name: string | null
  order_number: number
}

export interface ExamData {
  id: string
  name: string
  instructions: unknown
  starts_at: string
  ends_at: string
  ended: boolean
  time_minutes: number
  enrollment_data: ExamEnrollmentData
  language: string
}

export type ExamEnrollmentData =
  | { tag: "EnrolledAndStarted"; page_id: string; page: Page; enrollment: ExamEnrollment }
  | { tag: "NotEnrolled"; can_enroll: boolean }
  | { tag: "NotYetStarted" }
  | { tag: "StudentTimeUp" }

export interface CourseMaterialPeerOrSelfReviewDataWithToken {
  course_material_peer_or_self_review_data: CourseMaterialPeerOrSelfReviewData
  token: string | null
}

export interface CertificateConfigurationUpdate {
  course_module_id: string
  course_instance_id: string | null
  certificate_owner_name_y_pos: string | null
  certificate_owner_name_x_pos: string | null
  certificate_owner_name_font_size: string | null
  certificate_owner_name_text_color: string | null
  certificate_owner_name_text_anchor: CertificateTextAnchor | null
  certificate_validate_url_y_pos: string | null
  certificate_validate_url_x_pos: string | null
  certificate_validate_url_font_size: string | null
  certificate_validate_url_text_color: string | null
  certificate_validate_url_text_anchor: CertificateTextAnchor | null
  certificate_date_y_pos: string | null
  certificate_date_x_pos: string | null
  certificate_date_font_size: string | null
  certificate_date_text_color: string | null
  certificate_date_text_anchor: CertificateTextAnchor | null
  certificate_locale: string | null
  paper_size: PaperSize | null
  background_svg_file_name: string | null
  overlay_svg_file_name: string | null
  clear_overlay_svg_file: boolean
}

export interface GetFeedbackQuery {
  read: boolean
  page: number | undefined
  limit: number | undefined
}

export interface ExamCourseInfo {
  course_id: string
}

export interface NewExerciseRepository {
  course_id: string | null
  exam_id: string | null
  git_url: string
  deploy_key: string | null
}

export interface ExerciseSubmissions {
  data: Array<ExerciseSlideSubmission>
  total_pages: number
}

export interface MarkAsRead {
  read: boolean
}

export type PlaygroundViewsMessage =
  | { tag: "TimedOut" }
  | { tag: "Registered"; data: string }
  | { tag: "ExerciseTaskGradingResult"; data: ExerciseTaskGradingResult }

export interface GetEditProposalsQuery {
  pending: boolean
  page: number | undefined
  limit: number | undefined
}

export interface RoleQuery {
  global?: boolean
  organization_id?: string
  course_id?: string
  course_instance_id?: string
  exam_id?: string
}

export interface Pagination {
  page: number | undefined
  limit: number | undefined
}

export interface OEmbedResponse {
  author_name: string
  author_url: string
  html: string
  provider_name: string
  provider_url: string
  title: string
  version: string
}
