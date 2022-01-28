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
  copied_from: string | null
}

export type ChapterStatus = "open" | "closed"

export interface ChapterUpdate {
  name: string
  chapter_number: number
  front_front_page_id: string | null
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
}

export interface NewChapter {
  name: string
  course_id: string
  chapter_number: number
  front_front_page_id: string | null
}

export interface UserCourseInstanceChapterProgress {
  score_given: number
  score_maximum: number
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
  copied_from: string | null
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
  variant_status: VariantStatus
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

export type VariantStatus = "Draft" | "Upcoming" | "Active" | "Ended"

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
}

export interface CourseStructure {
  course: Course
  pages: Array<Page>
  chapters: Array<Chapter>
}

export interface CourseUpdate {
  name: string
}

export interface NewCourse {
  name: string
  slug: string
  organization_id: string
  language_code: string
  teacher_in_charge_name: string
  teacher_in_charge_email: string
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
  instructions: string
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
  exercise_iframe_url: string
  assignment: unknown
  public_spec: unknown | null
  model_solution_spec: unknown | null
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
}

export type ActivityProgress = "Initialized" | "Started" | "InProgress" | "Submitted" | "Completed"

export interface CourseMaterialExercise {
  exercise: Exercise
  current_exercise_tasks: Array<CourseMaterialExerciseTask>
  exercise_status: ExerciseStatus | null
  previous_submission: ExerciseTaskSubmission | null
  grading: Grading | null
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
}

export interface ExerciseStatus {
  score_given: number | null
  activity_progress: ActivityProgress
  grading_progress: GradingProgress
}

export type GradingProgress = "FullyGraded" | "Pending" | "PendingManual" | "Failed" | "NotReady"

export interface Feedback {
  id: string
  user_id: string | null
  course_id: string
  feedback_given: string
  selected_text: string | null
  marked_as_read: boolean
  created_at: Date
  blocks: Array<FeedbackBlock>
}

export interface FeedbackBlock {
  id: string
  text: string | null
}

export interface FeedbackCount {
  read: number
  unread: number
}

export interface NewFeedback {
  feedback_given: string
  selected_text: string | null
  related_blocks: Array<FeedbackBlock>
}

export interface Grading {
  id: string
  created_at: Date
  updated_at: Date
  submission_id: string
  course_id: string | null
  exam_id: string | null
  exercise_id: string
  exercise_task_id: string
  grading_priority: number
  score_given: number | null
  grading_progress: GradingProgress
  user_points_update_strategy: UserPointsUpdateStrategy
  unscaled_score_given: number | null
  unscaled_score_maximum: number | null
  grading_started_at: Date | null
  grading_completed_at: Date | null
  feedback_json: unknown | null
  feedback_text: string | null
  deleted_at: Date | null
}

export type UserPointsUpdateStrategy =
  | "CanAddPointsButCannotRemovePoints"
  | "CanAddPointsAndCanRemovePoints"

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

export interface PageRoutingDataWithChapterStatus {
  url_path: string
  title: string
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
  course_id: string | null
  course_instance_id: string | null
  exam_id: string | null
  exercise_id: string
  user_id: string
}

export interface ExerciseTaskSubmission {
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  exercise_slide_submission_id: string
  exercise_task_id: string
  data_json: unknown | null
  grading_id: string | null
  metadata: unknown | null
}

export interface SubmissionCount {
  date: Date | null
  count: number | null
}

export interface SubmissionCountByWeekAndHour {
  isodow: number | null
  hour: number | null
  count: number | null
}

export interface SubmissionCountByExercise {
  exercise_id: string | null
  count: number | null
  exercise_name: string | null
}

export interface SubmissionInfo {
  submission: ExerciseTaskSubmission
  exercise: Exercise
  exercise_task: ExerciseTask
  grading: Grading | null
  iframe_path: string
}

export interface SubmissionResult {
  submission: ExerciseTaskSubmission
  grading: Grading | null
  model_solution_spec: unknown | null
}

export interface NewSubmission {
  exercise_task_id: string
  course_instance_id: string | null
  data_json: unknown | null
}

export interface GradingResult {
  grading_progress: GradingProgress
  score_given: number
  score_maximum: number
  feedback_text: string | null
  feedback_json: unknown | null
}

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
  score_given: number
  score_maximum: number | null
  total_exercises: number | null
  completed_exercises: number | null
}

export interface User {
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  upstream_id: number | null
  email: string
}

export interface PreviousSubmission {
  submission: ExerciseTaskSubmission
  grading: Grading | null
}

export interface ExamData {
  id: string
  name: string
  instructions: string
  starts_at: Date
  ends_at: Date
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
}

export interface Pagination {
  page?: number
  limit?: number
}
