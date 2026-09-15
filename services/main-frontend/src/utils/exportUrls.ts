// Hrefs for the backend's CSV and file downloads. A download is a browser navigation, not a fetch,
// so these endpoints need a URL rather than one of the generated SDK's request functions. Each path
// is typed against the generated spec, so a route the backend renames fails the build here instead
// of 404ing in a user's browser.

import type {
  DownloadCodeGiveawayCodesCsvData,
  DownloadExerciseAnswerFilesData,
  ExportCourseCreditRegistrationsData,
  ExportCourseExerciseTasksCsvData,
  ExportCourseInstanceCompletionsCsvData,
  ExportCourseInstancePointsCsvData,
  ExportCourseInstancesCsvData,
  ExportCourseSubmissionsCsvData,
  ExportCourseUserConsentsCsvData,
  ExportCourseUserDetailsCsvData,
  ExportCourseUserExerciseStatesCsvData,
  ExportExamPointsCsvData,
  ExportExamSubmissionsCsvData,
  ExportExerciseAnswersCsvData,
  ExportExerciseDefinitionsCsvData,
} from "@/generated/api/types.generated"

import { buildGeneratedApiPath } from "./generatedApiUrl"

const COURSE_SUBMISSIONS_PATH: ExportCourseSubmissionsCsvData["url"] =
  "/api/v0/main-frontend/courses/{course_id}/export-submissions"
const COURSE_USER_DETAILS_PATH: ExportCourseUserDetailsCsvData["url"] =
  "/api/v0/main-frontend/courses/{course_id}/export-user-details"
const COURSE_EXERCISE_TASKS_PATH: ExportCourseExerciseTasksCsvData["url"] =
  "/api/v0/main-frontend/courses/{course_id}/export-exercise-tasks"
const COURSE_INSTANCES_PATH: ExportCourseInstancesCsvData["url"] =
  "/api/v0/main-frontend/courses/{course_id}/export-course-instances"
const COURSE_USER_CONSENTS_PATH: ExportCourseUserConsentsCsvData["url"] =
  "/api/v0/main-frontend/courses/{course_id}/export-course-user-consents"
const COURSE_USER_EXERCISE_STATES_PATH: ExportCourseUserExerciseStatesCsvData["url"] =
  "/api/v0/main-frontend/courses/{course_id}/export-user-exercise-states"
const COURSE_CREDIT_REGISTRATIONS_PATH: ExportCourseCreditRegistrationsData["url"] =
  "/api/v0/main-frontend/course-credit-registrations/courses/{course_id}/export"
const COURSE_INSTANCE_POINTS_PATH: ExportCourseInstancePointsCsvData["url"] =
  "/api/v0/main-frontend/course-instances/{course_instance_id}/export-points"
const COURSE_INSTANCE_COMPLETIONS_PATH: ExportCourseInstanceCompletionsCsvData["url"] =
  "/api/v0/main-frontend/course-instances/{course_instance_id}/export-completions"
const EXAM_POINTS_PATH: ExportExamPointsCsvData["url"] =
  "/api/v0/main-frontend/exams/{id}/export-points"
const EXAM_SUBMISSIONS_PATH: ExportExamSubmissionsCsvData["url"] =
  "/api/v0/main-frontend/exams/{id}/export-submissions"
const EXERCISE_DEFINITIONS_PATH: ExportExerciseDefinitionsCsvData["url"] =
  "/api/v0/main-frontend/exercises/{exercise_id}/export-definitions-csv"
const EXERCISE_ANSWERS_PATH: ExportExerciseAnswersCsvData["url"] =
  "/api/v0/main-frontend/exercises/{exercise_id}/export-answers-csv"
const EXERCISE_ANSWER_FILES_PATH: DownloadExerciseAnswerFilesData["url"] =
  "/api/v0/main-frontend/exercises/{exercise_id}/download-answer-files"
const CODE_GIVEAWAY_CODES_PATH: DownloadCodeGiveawayCodesCsvData["url"] =
  "/api/v0/main-frontend/code-giveaways/{id}/codes/csv"

export const courseSubmissionsCsvUrl = (courseId: string): string =>
  buildGeneratedApiPath(COURSE_SUBMISSIONS_PATH, { course_id: courseId })

export const courseUserDetailsCsvUrl = (courseId: string): string =>
  buildGeneratedApiPath(COURSE_USER_DETAILS_PATH, { course_id: courseId })

export const courseExerciseTasksCsvUrl = (courseId: string): string =>
  buildGeneratedApiPath(COURSE_EXERCISE_TASKS_PATH, { course_id: courseId })

export const courseInstancesCsvUrl = (courseId: string): string =>
  buildGeneratedApiPath(COURSE_INSTANCES_PATH, { course_id: courseId })

export const courseUserConsentsCsvUrl = (courseId: string): string =>
  buildGeneratedApiPath(COURSE_USER_CONSENTS_PATH, { course_id: courseId })

export const courseUserExerciseStatesCsvUrl = (courseId: string): string =>
  buildGeneratedApiPath(COURSE_USER_EXERCISE_STATES_PATH, { course_id: courseId })

export const courseCreditRegistrationsCsvUrl = (courseId: string): string =>
  buildGeneratedApiPath(COURSE_CREDIT_REGISTRATIONS_PATH, { course_id: courseId })

export const courseInstancePointsCsvUrl = (courseInstanceId: string): string =>
  buildGeneratedApiPath(COURSE_INSTANCE_POINTS_PATH, { course_instance_id: courseInstanceId })

export const courseInstanceCompletionsCsvUrl = (courseInstanceId: string): string =>
  buildGeneratedApiPath(COURSE_INSTANCE_COMPLETIONS_PATH, { course_instance_id: courseInstanceId })

export const examPointsCsvUrl = (examId: string): string =>
  buildGeneratedApiPath(EXAM_POINTS_PATH, { id: examId })

export const examSubmissionsCsvUrl = (examId: string): string =>
  buildGeneratedApiPath(EXAM_SUBMISSIONS_PATH, { id: examId })

export const exerciseDefinitionsCsvUrl = (
  exerciseId: string,
  query: ExportExerciseDefinitionsCsvData["query"],
): string => buildGeneratedApiPath(EXERCISE_DEFINITIONS_PATH, { exercise_id: exerciseId }, query)

export const exerciseAnswersCsvUrl = (
  exerciseId: string,
  query: ExportExerciseAnswersCsvData["query"],
): string => buildGeneratedApiPath(EXERCISE_ANSWERS_PATH, { exercise_id: exerciseId }, query)

export const exerciseAnswerFilesUrl = (exerciseId: string): string =>
  buildGeneratedApiPath(EXERCISE_ANSWER_FILES_PATH, { exercise_id: exerciseId })

export const codeGiveawayCodesCsvUrl = (codeGiveawayId: string): string =>
  buildGeneratedApiPath(CODE_GIVEAWAY_CODES_PATH, { id: codeGiveawayId })
