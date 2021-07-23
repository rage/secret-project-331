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

export interface CourseStructure {
  course: Course
  pages: Page[]
  chapters: Chapter[]
}

export interface Page {
  id: string
  created_at: Date
  updated_at: Date
  course_id: string
  chapter_id: string | null
  url_path: string
  title: string
  deleted_at: Date | null
  content: unknown
  order_number: number
}

export interface UploadResult {
  url: string
}

export interface PageWithExercises {
  id: string
  created_at: Date
  updated_at: Date
  course_id: string
  chapter_id: string | null
  content: unknown
  url_path: string
  title: string
  order_number: number
  deleted_at: Date | null
  exercises: Exercise[]
}

export interface UserProgress {
  score_given: number | null
  score_maximum: number | null
  total_exercises: number | null
  completed_exercises: number | null
}

export interface CourseInstanceEnrollment {
  user_id: string
  course_id: string
  course_instance_id: string
  current: boolean
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
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

export interface CourseMaterialExercise {
  exercise: Exercise
  current_exercise_task: CourseMaterialExerciseTask
  current_exercise_task_service_info: CourseMaterialExerciseServiceInfo | null
  exercise_status: ExerciseStatus | null
}

export interface PageRoutingData {
  url_path: string
  title: string
  chapter_number: number
  chapter_id: string
}

export interface SubmissionResult {
  submission: Submission
  grading: Grading
}

export interface Course {
  id: string
  slug: string
  created_at: Date
  updated_at: Date
  name: string
  organization_id: string
  deleted_at: Date | null
}

export interface Exercise {
  id: string
  created_at: Date
  updated_at: Date
  name: string
  course_id: string
  page_id: string
  chapter_id: string
  deadline: Date | null
  deleted_at: Date | null
  score_maximum: number
  order_number: number
}

export interface ExerciseServiceInfoApi {
  service_name: string
  editor_iframe_path: string
  exercise_iframe_path: string
  submission_iframe_path: string
  grade_endpoint_path: string
  public_spec_endpoint_path: string
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

export interface ExerciseSubmissions {
  data: Submission[]
  total_pages: number
}

export interface Organization {
  id: string
  slug: string
  created_at: Date
  updated_at: Date
  name: string
  deleted_at: Date | null
}

export interface NewChapter {
  name: string
  course_id: string
  chapter_number: number
  front_front_page_id: string | null
}

export interface ChapterUpdate {
  name: string
  chapter_number: number
  front_front_page_id: string | null
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

export interface NewPage {
  content: unknown
  url_path: string
  title: string
  course_id: string
  chapter_id: string | null
  front_page_of_chapter_id: string | null
}

export interface PageUpdate {
  content: unknown
  url_path: string
  title: string
  chapter_id: string | null
  front_page_of_chapter_id: string | null
}

export interface NewSubmission {
  exercise_task_id: string
  course_instance_id: string
  data_json: unknown | null
}

export interface NewCourse {
  name: string
  slug: string
  organization_id: string
}

export interface CourseUpdate {
  name: string
}

export interface Login {
  email: string
  password: string
}

export interface SubmissionInfo {
  submission: Submission
  exercise: Exercise
  exercise_task: ExerciseTask
  grading: Grading | null
  submission_iframe_path: string
}

export type VariantStatus = "Draft" | "Upcoming" | "Active" | "Ended"

export type ChapterStatus = "open" | "closed"

export interface CourseMaterialExerciseTask {
  id: string
  exercise_id: string
  exercise_type: string
  assignment: unknown
  public_spec: unknown | null
}

export interface CourseMaterialExerciseServiceInfo {
  exercise_iframe_url: string
}

export interface ExerciseStatus {
  score_given: number | null
  activity_progress: ActivityProgress
  grading_progress: GradingProgress
}

export interface Submission {
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  exercise_id: string
  course_id: string
  course_instance_id: string
  exercise_task_id: string
  data_json: unknown | null
  grading_id: string | null
  metadata: unknown | null
  user_id: string
}

export interface Grading {
  id: string
  created_at: Date
  updated_at: Date
  submission_id: string
  course_id: string
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

export type ActivityProgress = "Initialized" | "Started" | "InProgress" | "Submitted" | "Completed"

export type GradingProgress = "FullyGraded" | "Pending" | "PendingManual" | "Failed" | "NotReady"

export type UserPointsUpdateStrategy =
  | "CanAddPointsButCannotRemovePoints"
  | "CanAddPointsAndCanRemovePoints"

export interface ExerciseTask {
  id: string
  created_at: Date
  updated_at: Date
  exercise_id: string
  exercise_type: string
  assignment: unknown
  deleted_at: Date | null
  public_spec: unknown | null
  private_spec: unknown | null
  spec_file_id: string | null
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
  exercise_tasks: ExerciseTask[]
  score_maximum: number
}

export interface PageUpdateExercise {
  id: string
  name: string
  order_number: number
  exercise_tasks: PageUpdateExerciseTask[]
}

export interface PageUpdateExerciseTask {
  id: string
  exercise_type: string
  assignment: unknown
  public_spec: unknown | null
  private_spec: unknown | null
}
