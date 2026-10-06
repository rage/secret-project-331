import { client as generatedApiClient } from "@/generated/api/client.generated"
import type {
  DownloadCodeGiveawayCodesCsvData,
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
  DownloadExerciseAnswerFilesData,
  ExportCourseCreditRegistrationsData,
} from "@/generated/api/types.generated"

// Same-origin relative hrefs, safe to render on the server. Typing each template with the
// generated `url` type makes API path changes a compile error here.
const buildDownloadHref = (
  url: string,
  path: Record<string, string>,
  query?: Record<string, string | boolean | undefined>,
): string => generatedApiClient.buildUrl({ url, path, ...(query ? { query } : {}) })

const courseExportHref = (
  url:
    | ExportCourseSubmissionsCsvData["url"]
    | ExportCourseUserDetailsCsvData["url"]
    | ExportCourseExerciseTasksCsvData["url"]
    | ExportCourseInstancesCsvData["url"]
    | ExportCourseUserConsentsCsvData["url"]
    | ExportCourseUserExerciseStatesCsvData["url"],
  courseId: string,
): string => buildDownloadHref(url, { course_id: courseId })

export const codeGiveawayCodesCsvHref = (id: string): string => {
  const url: DownloadCodeGiveawayCodesCsvData["url"] =
    "/api/v0/main-frontend/code-giveaways/{id}/codes/csv"
  return buildDownloadHref(url, { id })
}

export const courseInstancePointsCsvHref = (courseInstanceId: string): string => {
  const url: ExportCourseInstancePointsCsvData["url"] =
    "/api/v0/main-frontend/course-instances/{course_instance_id}/export-points"
  return buildDownloadHref(url, { course_instance_id: courseInstanceId })
}

export const courseInstanceCompletionsCsvHref = (courseInstanceId: string): string => {
  const url: ExportCourseInstanceCompletionsCsvData["url"] =
    "/api/v0/main-frontend/course-instances/{course_instance_id}/export-completions"
  return buildDownloadHref(url, { course_instance_id: courseInstanceId })
}

export const courseSubmissionsCsvHref = (courseId: string): string =>
  courseExportHref("/api/v0/main-frontend/courses/{course_id}/export-submissions", courseId)

export const courseUserDetailsCsvHref = (courseId: string): string =>
  courseExportHref("/api/v0/main-frontend/courses/{course_id}/export-user-details", courseId)

export const courseExerciseTasksCsvHref = (courseId: string): string =>
  courseExportHref("/api/v0/main-frontend/courses/{course_id}/export-exercise-tasks", courseId)

export const courseInstancesCsvHref = (courseId: string): string =>
  courseExportHref("/api/v0/main-frontend/courses/{course_id}/export-course-instances", courseId)

export const courseUserConsentsCsvHref = (courseId: string): string =>
  courseExportHref(
    "/api/v0/main-frontend/courses/{course_id}/export-course-user-consents",
    courseId,
  )

export const courseUserExerciseStatesCsvHref = (courseId: string): string =>
  courseExportHref(
    "/api/v0/main-frontend/courses/{course_id}/export-user-exercise-states",
    courseId,
  )

export const examPointsCsvHref = (id: string): string => {
  const url: ExportExamPointsCsvData["url"] = "/api/v0/main-frontend/exams/{id}/export-points"
  return buildDownloadHref(url, { id })
}

export const examSubmissionsCsvHref = (id: string): string => {
  const url: ExportExamSubmissionsCsvData["url"] =
    "/api/v0/main-frontend/exams/{id}/export-submissions"
  return buildDownloadHref(url, { id })
}

export const exerciseDefinitionsCsvHref = (exerciseId: string, exerciseTaskId: string): string => {
  const url: ExportExerciseDefinitionsCsvData["url"] =
    "/api/v0/main-frontend/exercises/{exercise_id}/export-definitions-csv"
  return buildDownloadHref(url, { exercise_id: exerciseId }, { exercise_task_id: exerciseTaskId })
}

export const exerciseAnswersCsvHref = (
  exerciseId: string,
  exerciseTaskId: string,
  onlyLatestPerUser: boolean,
): string => {
  const url: ExportExerciseAnswersCsvData["url"] =
    "/api/v0/main-frontend/exercises/{exercise_id}/export-answers-csv"
  return buildDownloadHref(
    url,
    { exercise_id: exerciseId },
    {
      exercise_task_id: exerciseTaskId,
      only_latest_per_user: onlyLatestPerUser ? true : undefined,
    },
  )
}

export const exerciseAnswerFilesHref = (exerciseId: string): string => {
  const url: DownloadExerciseAnswerFilesData["url"] =
    "/api/v0/main-frontend/exercises/{exercise_id}/download-answer-files"
  return buildDownloadHref(url, { exercise_id: exerciseId })
}

export const courseCreditRegistrationsCsvHref = (courseId: string): string => {
  const url: ExportCourseCreditRegistrationsData["url"] =
    "/api/v0/main-frontend/course-credit-registrations/courses/{course_id}/export"
  return buildDownloadHref(url, { course_id: courseId })
}
