// ###########################################
// ## This file is autogenerated by running ##
// ## "bin/generate-bindings" in the root   ##
// ## folder of this repo                   ##
// ##                                       ##
// ## Do not edit this file by hand.        ##
// ###########################################

export interface ActionOnResource {
  action: Action
  resource: Resource
}

export type Action =
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

export interface Term {
  id: string
  term: string
  definition: string
}

export interface TermUpdate {
  term: string
  definition: string
}

export interface Chapter {
  id: string
  created_at: Date
  updated_at: Date
  name: string
  course_id: string
  deleted_at: Date | null
  chapter_image_url: string | null
  chapter_number: number
  front_page_id: string | null
  opens_at: Date | null
  deadline: Date | null
  copied_from: string | null
  course_module_id: string
}

export interface DatabaseChapter {
  id: string
  created_at: Date
  updated_at: Date
  name: string
  course_id: string
  deleted_at: Date | null
  chapter_image_path: string | null
  chapter_number: number
  front_page_id: string | null
  opens_at: Date | null
  deadline: Date | null
  copied_from: string | null
  course_module_id: string
}

export type ChapterStatus = "open" | "closed"

export interface ChapterUpdate {
  name: string
  front_page_id: string | null
  deadline: Date | null
  opens_at: Date | null
  course_module_id: string | null
}

export interface ChapterWithStatus {
  id: string
  created_at: Date
  updated_at: Date
  name: string
  course_id: string
  deleted_at: Date | null
  chapter_number: number
  front_page_id: string | null
  opens_at: Date | null
  status: ChapterStatus
  chapter_image_url: string | null
  course_module_id: string
}

export interface NewChapter {
  name: string
  course_id: string
  chapter_number: number
  front_page_id: string | null
  opens_at: Date | null
  deadline: Date | null
  course_module_id: string | null
}

export interface UserCourseInstanceChapterProgress {
  score_given: number
  score_maximum: number
  total_exercises: number | null
  attempted_exercises: number | null
}

export interface CourseInstanceEnrollment {
  user_id: string
  course_id: string
  course_instance_id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export interface ChapterScore {
  id: string
  created_at: Date
  updated_at: Date
  name: string
  course_id: string
  deleted_at: Date | null
  chapter_image_path: string | null
  chapter_number: number
  front_page_id: string | null
  opens_at: Date | null
  deadline: Date | null
  copied_from: string | null
  course_module_id: string
  score_given: number
  score_total: number
}

export interface CourseInstance {
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  course_id: string
  starts_at: Date | null
  ends_at: Date | null
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
  opening_time: Date | null
  closing_time: Date | null
}

export type PointMap = Record<string, number>

export interface Points {
  chapter_points: Array<ChapterScore>
  users: Array<User>
  user_chapter_points: Record<string, PointMap>
}

export interface Module {
  id: string
  name: string | null
  course_id: string
  order_number: number
  copied_from: string | null
  uh_course_code: string | null
}

export interface Course {
  id: string
  slug: string
  created_at: Date
  updated_at: Date
  name: string
  description: string | null
  organization_id: string
  deleted_at: Date | null
  language_code: string
  copied_from: string | null
  content_search_language: string | null
  course_language_group_id: string
  is_draft: boolean
  is_test_mode: boolean
}

export interface CourseStructure {
  course: Course
  pages: Array<Page>
  chapters: Array<Chapter>
}

export interface CourseUpdate {
  name: string
  is_draft: boolean
  is_test_mode: boolean
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
}

export interface CourseCount {
  count: number
}

export interface EmailTemplate {
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
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
  starts_at: Date | null
  ends_at: Date | null
  time_minutes: number
}

export interface ExamEnrollment {
  user_id: string
  exam_id: string
  started_at: Date
}

export interface NewExam {
  name: string
  starts_at: Date | null
  ends_at: Date | null
  time_minutes: number
  organization_id: string
}

export interface OrgExam {
  id: string
  name: string
  instructions: unknown
  starts_at: Date | null
  ends_at: Date | null
  time_minutes: number
  organization_id: string
}

export interface ExamInstructions {
  id: string
  instructions: unknown
}

export interface ExamInstructionsUpdate {
  instructions: unknown
}

export interface CourseMaterialExerciseServiceInfo {
  exercise_iframe_url: string
}

export interface ExerciseServiceInfoApi {
  service_name: string
  exercise_type_specific_user_interface_iframe: string
  grade_endpoint_path: string
  public_spec_endpoint_path: string
  model_solution_path: string
}

export interface ExerciseService {
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  name: string
  slug: string
  public_url: string
  internal_url: string | null
  max_reprocessing_submissions_at_once: number
}

export interface ExerciseServiceNewOrUpdate {
  name: string
  slug: string
  public_url: string
  internal_url: string | null
  max_reprocessing_submissions_at_once: number
}

export interface CourseMaterialExerciseSlide {
  id: string
  exercise_tasks: Array<CourseMaterialExerciseTask>
}

export interface ExerciseSlide {
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  exercise_id: string
  order_number: number
}

export interface CourseMaterialExerciseTask {
  id: string
  exercise_slide_id: string
  exercise_iframe_url: string | null
  assignment: unknown
  public_spec: unknown | null
  model_solution_spec: unknown | null
  previous_submission: ExerciseTaskSubmission | null
  previous_submission_grading: ExerciseTaskGrading | null
  order_number: number
}

export interface ExerciseTask {
  id: string
  created_at: Date
  updated_at: Date
  exercise_slide_id: string
  exercise_type: string
  assignment: unknown
  deleted_at: Date | null
  public_spec: unknown | null
  private_spec: unknown | null
  spec_file_id: string | null
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
  peer_review: PeerReview | null
}

export interface Exercise {
  id: string
  created_at: Date
  updated_at: Date
  name: string
  course_id: string | null
  exam_id: string | null
  page_id: string
  chapter_id: string | null
  deadline: Date | null
  deleted_at: Date | null
  score_maximum: number
  order_number: number
  copied_from: string | null
  max_tries_per_slide: number | null
  limit_number_of_tries: boolean
  needs_peer_review: boolean
}

export interface ExerciseStatus {
  score_given: number | null
  activity_progress: ActivityProgress
  grading_progress: GradingProgress
  reviewing_stage: ReviewingStage
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
  created_at: Date
  blocks: Array<FeedbackBlock>
  page_title: string | null
  page_url_path: string | null
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

export interface StudentExerciseSlideSubmission {
  exercise_slide_id: string
  exercise_task_submissions: Array<StudentExerciseTaskSubmission>
}

export interface StudentExerciseSlideSubmissionResult {
  exercise_status: ExerciseStatus | null
  exercise_task_submission_results: Array<StudentExerciseTaskSubmissionResult>
}

export interface StudentExerciseTaskSubmission {
  exercise_task_id: string
  data_json: unknown
}

export interface StudentExerciseTaskSubmissionResult {
  submission: ExerciseTaskSubmission
  grading: ExerciseTaskGrading | null
  model_solution_spec: unknown | null
}

export interface CourseMaterialPeerReviewData {
  answer_to_review: CourseMaterialPeerReviewDataAnswerToReview | null
  peer_review: PeerReview
  peer_review_questions: Array<PeerReviewQuestion>
  num_peer_reviews_given: number
}

export interface CourseMaterialPeerReviewDataAnswerToReview {
  exercise_slide_submission_id: string
  course_material_exercise_tasks: Array<CourseMaterialExerciseTask>
}

export interface CourseMaterialPeerReviewQuestionAnswer {
  peer_review_question_id: string
  text_data: string | null
  number_data: number | null
}

export interface CourseMaterialPeerReviewSubmission {
  exercise_slide_submission_id: string
  peer_review_id: string
  peer_review_question_answers: Array<CourseMaterialPeerReviewQuestionAnswer>
}

export interface Organization {
  id: string
  slug: string
  created_at: Date
  updated_at: Date
  name: string
  description: string | null
  organization_image_url: string | null
  deleted_at: Date | null
}

export interface PageHistory {
  id: string
  created_at: Date
  title: string
  content: unknown
  history_change_reason: HistoryChangeReason
  restored_from_id: string | null
  author_user_id: string
}

export type HistoryChangeReason = "PageSaved" | "HistoryRestored"

export interface CmsPageExercise {
  id: string
  name: string
  order_number: number
  score_maximum: number
  max_tries_per_slide: number | null
  limit_number_of_tries: boolean
  deadline: Date | null
  needs_peer_review: boolean
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
  created_at: Date
  updated_at: Date
  course_id: string
  deleted_at: Date | null
  name: string
  deadline: Date | null
  page_id: string
  exercise_tasks: Array<ExerciseTask>
  score_maximum: number
}

export interface HistoryRestoreData {
  history_id: string
}

export interface Page {
  id: string
  created_at: Date
  updated_at: Date
  course_id: string | null
  exam_id: string | null
  chapter_id: string | null
  url_path: string
  title: string
  deleted_at: Date | null
  content: unknown
  order_number: number
  copied_from: string | null
}

export interface PageInfo {
  page_id: string
  page_title: string
  course_id: string | null
  course_name: string | null
  course_slug: string | null
  organization_slug: string | null
}

export interface PageRoutingDataWithChapterStatus {
  url_path: string
  title: string
  page_id: string
  chapter_number: number
  chapter_id: string
  chapter_opens_at: Date | null
  chapter_front_page_id: string | null
  chapter_status: ChapterStatus
}

export interface PageSearchRequest {
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
  created_at: Date
  updated_at: Date
  course_id: string | null
  exam_id: string | null
  chapter_id: string | null
  url_path: string
  title: string
  deleted_at: Date | null
  content: unknown
  order_number: number
  copied_from: string | null
  exercises: Array<Exercise>
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

export interface PageChapterAndCourseInformation {
  chapter_name: string | null
  chapter_number: number | null
  course_name: string | null
  course_slug: string | null
  chapter_front_page_id: string | null
  chapter_front_page_url_path: string | null
  organization_slug: string
}

export interface PeerReview {
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  course_id: string
  exercise_id: string | null
  peer_reviews_to_give: number
  peer_reviews_to_receive: number
  accepting_threshold: number
  accepting_strategy: PeerReviewAcceptingStrategy
}

export type PeerReviewAcceptingStrategy =
  | "AutomaticallyAcceptOrRejectByAverage"
  | "AutomaticallyAcceptOrManualReviewByAverage"
  | "ManualReviewEverything"

export interface NewPeerReviewQuestion {
  peer_review_id: string
  order_number: number
  question: string
  question_type: PeerReviewQuestionType
  answer_required: boolean
}

export interface PeerReviewQuestion {
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  peer_review_id: string
  order_number: number
  question: string
  question_type: PeerReviewQuestionType
  answer_required: boolean
}

export type PeerReviewQuestionType = "Essay" | "Scale"

export interface PlaygroundExample {
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
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

export interface BlockProposal {
  id: string
  block_id: string
  current_text: string
  changed_text: string
  original_text: string
  status: ProposalStatus
  accept_preview: string | null
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
  created_at: Date
  block_proposals: Array<BlockProposal>
  page_title: string
  page_url_path: string
}

export interface ProposalCount {
  pending: number
  handled: number
}

export interface ExerciseSlideSubmission {
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  exercise_slide_id: string
  course_id: string | null
  course_instance_id: string | null
  exam_id: string | null
  exercise_id: string
  user_id: string
  user_points_update_strategy: UserPointsUpdateStrategy
}

export interface ExerciseSlideSubmissionCount {
  date: Date | null
  count: number | null
}

export interface ExerciseSlideSubmissionCountByExercise {
  exercise_id: string | null
  count: number | null
  exercise_name: string | null
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

export interface ExerciseTaskGrading {
  id: string
  created_at: Date
  updated_at: Date
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
  grading_started_at: Date | null
  grading_completed_at: Date | null
  feedback_json: unknown | null
  feedback_text: string | null
  deleted_at: Date | null
}

export interface ExerciseTaskGradingResult {
  grading_progress: GradingProgress
  score_given: number
  score_maximum: number
  feedback_text: string | null
  feedback_json: unknown | null
}

export type UserPointsUpdateStrategy =
  | "CanAddPointsButCannotRemovePoints"
  | "CanAddPointsAndCanRemovePoints"

export interface ExerciseTaskSubmission {
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  exercise_slide_submission_id: string
  exercise_task_id: string
  exercise_slide_id: string
  data_json: unknown | null
  exercise_task_grading_id: string | null
  metadata: unknown | null
}

export interface RoleUser {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  role: UserRole
}

export type RoleDomain =
  | { tag: "Global" }
  | { tag: "Organization"; id: string }
  | { tag: "Course"; id: string }
  | { tag: "CourseInstance"; id: string }
  | { tag: "Exam"; id: string }

export type UserRole = "Reviewer" | "Assistant" | "Teacher" | "Admin" | "CourseOrExamCreator"

export interface UserCourseSettings {
  user_id: string
  course_language_group_id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  current_course_id: string
  current_course_instance_id: string
}

export interface UserCourseInstanceChapterExerciseProgress {
  exercise_id: string
  score_given: number
}

export interface UserCourseInstanceProgress {
  course_module_id: string
  course_module_name: string
  course_module_order_number: number
  score_given: number
  score_maximum: number | null
  total_exercises: number | null
  attempted_exercises: number | null
}

export interface ExerciseUserCounts {
  exercise_name: string | null
  exercise_order_number: number | null
  page_order_number: number | null
  chapter_number: number | null
  exercise_id: string | null
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

export interface User {
  id: string
  first_name: string | null
  last_name: string | null
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  upstream_id: number | null
  email: string
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

export interface RoleQuery {
  global?: boolean
  organization_id?: string
  course_id?: string
  course_instance_id?: string
  exam_id?: string
}

export interface RoleInfo {
  email: string
  role: UserRole
  domain: RoleDomain
}

export interface ExamData {
  id: string
  name: string
  instructions: unknown
  starts_at: Date
  ends_at: Date
  ended: boolean
  time_minutes: number
  enrollment_data: ExamEnrollmentData
}

export type ExamEnrollmentData =
  | { tag: "EnrolledAndStarted"; page_id: string; page: Page; enrollment: ExamEnrollment }
  | { tag: "NotEnrolled" }
  | { tag: "NotYetStarted" }
  | { tag: "StudentTimeUp" }

export interface ExamCourseInfo {
  course_id: string
}

export interface Login {
  email: string
  password: string
}

export interface UploadResult {
  url: string
}

export interface ExerciseSubmissions {
  data: Array<ExerciseSlideSubmission>
  total_pages: number
}

export interface MarkAsRead {
  read: boolean
}

export interface GetFeedbackQuery {
  read: boolean
  page?: number
  limit?: number
}

export interface GetEditProposalsQuery {
  pending: boolean
  page?: number
  limit?: number
}

export interface ErrorResponse {
  title: string
  message: string
  source: string | null
  data: ErrorData | null
}

export type ErrorData = { block_id: string }

export interface Pagination {
  page?: number
  limit?: number
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

export interface MaterialReference {
  id: string
  course_id: string
  citation_key: string
  reference: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export interface NewMaterialReference {
  citation_key: string
  reference: string
}
