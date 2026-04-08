import { queryOptions } from "@tanstack/react-query"

import {
  duplicateExamMutation,
  editExamMutation,
  getExamExercisesOptions as getExamExercisesGeneratedOptions,
  getExamOptions as getExamGeneratedOptions,
  getExamSubmissionsWithExamIdOptions as getExamSubmissionsWithExamIdGeneratedOptions,
  getExamSubmissionsWithExerciseIdOptions as getExamSubmissionsWithExerciseIdGeneratedOptions,
  getOrganizationCourseExamsOptions as getOrganizationCourseExamsGeneratedOptions,
  getOrganizationExamByExamIdOptions as getOrganizationExamByExamIdGeneratedOptions,
  getOrganizationExamsOptions as getOrganizationExamsGeneratedOptions,
  releaseExamGradesMutation,
  setExamCourseMutation,
  unsetExamCourseMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  exportExamPointsCsv as exportExamPointsCsvFromApi,
  exportExamSubmissionsCsv as exportExamSubmissionsCsvFromApi,
  getOrganizationCourseExams as getOrganizationCourseExamsFromApi,
  getOrganizationExamByExamId as getOrganizationExamByExamIdFromApi,
  getOrganizationExams as getOrganizationExamsFromApi,
} from "@/generated/api/sdk.generated"
import type {
  Course as GeneratedCourse,
  Exam as GeneratedExam,
  ExamEnrollment as GeneratedExamEnrollment,
  Exercise as GeneratedExercise,
  ExerciseSlideSubmission as GeneratedExerciseSlideSubmission,
  ExerciseSlideSubmissionAndUserExerciseState as GeneratedExerciseSlideSubmissionAndUserExerciseState,
  ExerciseSlideSubmissionAndUserExerciseStateList as GeneratedExerciseSlideSubmissionAndUserExerciseStateList,
  TeacherGradingDecision as GeneratedTeacherGradingDecision,
  UserExerciseState as GeneratedUserExerciseState,
} from "@/generated/api/types.generated"
import type {
  Course,
  CourseExam,
  Exam,
  ExamEnrollment,
  Exercise,
  ExerciseSlideSubmission,
  ExerciseSlideSubmissionAndUserExerciseState,
  ExerciseSlideSubmissionAndUserExerciseStateList,
  OrgExam,
  TeacherGradingDecision,
  UserExerciseState,
} from "@/shared-module/common/bindings"
import { isCourseExam, isOrgExam } from "@/shared-module/common/bindings.guard"
import { isArray } from "@/shared-module/common/utils/fetching"

export interface DownloadedCsvFile {
  blob: Blob
  fileName: string
}

const validateGeneratedData = <T>(data: unknown, isT: (value: unknown) => value is T): T => {
  if (isT(data)) {
    return data
  }

  throw new Error(`Invalid data from API: ${JSON.stringify(data, undefined, 2)}`)
}

const normalizeCourse = (course: GeneratedCourse): Course => ({
  ...course,
  closed_additional_message: course.closed_additional_message ?? null,
  closed_at: course.closed_at ?? null,
  closed_course_successor_id: course.closed_course_successor_id ?? null,
  content_search_language: course.content_search_language ?? null,
  copied_from: course.copied_from ?? null,
  deleted_at: course.deleted_at ?? null,
  description: course.description ?? null,
  flagged_answers_threshold: course.flagged_answers_threshold ?? null,
  join_code: course.join_code ?? null,
})

const normalizeExam = (exam: GeneratedExam): Exam => ({
  ...exam,
  courses: exam.courses.map(normalizeCourse),
  ends_at: exam.ends_at ?? null,
  starts_at: exam.starts_at ?? null,
})

const normalizeExercise = (exercise: GeneratedExercise): Exercise => ({
  ...exercise,
  chapter_id: exercise.chapter_id ?? null,
  copied_from: exercise.copied_from ?? null,
  course_id: exercise.course_id ?? null,
  deadline: exercise.deadline ?? null,
  deleted_at: exercise.deleted_at ?? null,
  exam_id: exercise.exam_id ?? null,
  exercise_language_group_id: exercise.exercise_language_group_id ?? null,
  max_tries_per_slide: exercise.max_tries_per_slide ?? null,
})

const normalizeExerciseSlideSubmission = (
  submission: GeneratedExerciseSlideSubmission,
): ExerciseSlideSubmission => ({
  ...submission,
  course_id: submission.course_id ?? null,
  deleted_at: submission.deleted_at ?? null,
  exam_id: submission.exam_id ?? null,
  flag_count: submission.flag_count ?? null,
})

const normalizeUserExerciseState = (
  userExerciseState: GeneratedUserExerciseState,
): UserExerciseState => ({
  ...userExerciseState,
  course_id: userExerciseState.course_id ?? null,
  deleted_at: userExerciseState.deleted_at ?? null,
  exam_id: userExerciseState.exam_id ?? null,
  score_given: userExerciseState.score_given ?? null,
  selected_exercise_slide_id: userExerciseState.selected_exercise_slide_id ?? null,
})

const normalizeTeacherGradingDecision = (
  teacherGradingDecision: GeneratedTeacherGradingDecision,
): TeacherGradingDecision => ({
  ...teacherGradingDecision,
  deleted_at: teacherGradingDecision.deleted_at ?? null,
  hidden: teacherGradingDecision.hidden ?? null,
  justification: teacherGradingDecision.justification ?? null,
})

const normalizeExamEnrollment = (examEnrollment: GeneratedExamEnrollment): ExamEnrollment => ({
  ...examEnrollment,
  ended_at: examEnrollment.ended_at ?? null,
  show_exercise_answers: examEnrollment.show_exercise_answers ?? null,
})

const normalizeExerciseSlideSubmissionAndUserExerciseState = (
  submission: GeneratedExerciseSlideSubmissionAndUserExerciseState,
): ExerciseSlideSubmissionAndUserExerciseState => ({
  exercise: normalizeExercise(submission.exercise),
  exercise_slide_submission: normalizeExerciseSlideSubmission(submission.exercise_slide_submission),
  teacher_grading_decision: submission.teacher_grading_decision
    ? normalizeTeacherGradingDecision(submission.teacher_grading_decision)
    : null,
  user_exam_enrollment: normalizeExamEnrollment(submission.user_exam_enrollment),
  user_exercise_state: normalizeUserExerciseState(submission.user_exercise_state),
})

const normalizeExerciseSlideSubmissionAndUserExerciseStateList = (
  submissionList: GeneratedExerciseSlideSubmissionAndUserExerciseStateList,
): ExerciseSlideSubmissionAndUserExerciseStateList => ({
  data: submissionList.data.map(normalizeExerciseSlideSubmissionAndUserExerciseState),
  total_pages: submissionList.total_pages,
})

export const fetchOrgExam = async (examId: string): Promise<OrgExam> => {
  const data = await getOrganizationExamByExamIdFromApi({
    path: {
      exam_id: examId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isOrgExam)
}

export const getOrganizationExamByExamIdOptions = (examId: string) =>
  queryOptions({
    ...getOrganizationExamByExamIdGeneratedOptions({
      path: {
        exam_id: examId,
      },
    }),
    select: (data): OrgExam => validateGeneratedData(data, isOrgExam),
  })

export const fetchCourseExams = async (organizationId: string): Promise<Array<CourseExam>> => {
  const data = await getOrganizationCourseExamsFromApi({
    path: {
      organization_id: organizationId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isCourseExam))
}

export const getOrganizationCourseExamsOptions = (organizationId: string) =>
  queryOptions({
    ...getOrganizationCourseExamsGeneratedOptions({
      path: {
        organization_id: organizationId,
      },
    }),
    select: (data): CourseExam[] => validateGeneratedData(data, isArray(isCourseExam)),
  })

export const fetchOrganizationExams = async (organizationId: string): Promise<Array<OrgExam>> => {
  const data = await getOrganizationExamsFromApi({
    path: {
      organization_id: organizationId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isOrgExam))
}

export const getOrganizationExamsOptions = (organizationId: string) =>
  queryOptions({
    ...getOrganizationExamsGeneratedOptions({
      path: {
        organization_id: organizationId,
      },
    }),
    select: (data): OrgExam[] => validateGeneratedData(data, isArray(isOrgExam)),
  })

export const getExamOptions = (id: string) =>
  queryOptions({
    ...getExamGeneratedOptions({
      path: {
        id,
      },
    }),
    select: (exam): Exam => normalizeExam(exam),
  })

export const getExamExercisesOptions = (examId: string) =>
  queryOptions({
    ...getExamExercisesGeneratedOptions({
      path: {
        exam_id: examId,
      },
    }),
    select: (exercises): Exercise[] => exercises.map(normalizeExercise),
  })

export const getExamSubmissionsWithExamIdOptions = (
  examId: string,
  page?: number,
  limit?: number,
) =>
  queryOptions({
    ...getExamSubmissionsWithExamIdGeneratedOptions({
      path: {
        exam_id: examId,
      },
      ...(page || limit
        ? {
            query: {
              ...(page ? { page } : {}),
              ...(limit ? { limit } : {}),
            },
          }
        : {}),
    }),
    select: (submissionLists): ExerciseSlideSubmissionAndUserExerciseState[][] =>
      submissionLists.map((submissionList) =>
        submissionList.map(normalizeExerciseSlideSubmissionAndUserExerciseState),
      ),
  })

export const getExamSubmissionsWithExerciseIdOptions = (
  exerciseId: string,
  page: number,
  limit: number,
) =>
  queryOptions({
    ...getExamSubmissionsWithExerciseIdGeneratedOptions({
      path: {
        exercise_id: exerciseId,
      },
      query: {
        page,
        limit,
      },
    }),
    select: (submissionList): ExerciseSlideSubmissionAndUserExerciseStateList =>
      normalizeExerciseSlideSubmissionAndUserExerciseStateList(submissionList),
  })

export const duplicateExamMutationOptions = () => duplicateExamMutation()

export const editExamMutationOptions = () => editExamMutation()

export const setExamCourseMutationOptions = () => setExamCourseMutation()

export const unsetExamCourseMutationOptions = () => unsetExamCourseMutation()

export const releaseExamGradesMutationOptions = () => releaseExamGradesMutation()

export const downloadExamPointsCsv = async (
  examId: string,
  fileName = `exam-${examId}-points.csv`,
): Promise<DownloadedCsvFile> => {
  const data: unknown = await exportExamPointsCsvFromApi({
    parseAs: "blob",
    path: {
      id: examId,
    },
    throwOnError: true,
  })

  if (!(data instanceof Blob)) {
    throw new Error("Invalid exam points CSV response")
  }

  return {
    blob: data,
    fileName,
  }
}

export const downloadExamSubmissionsCsv = async (
  examId: string,
  fileName = `exam-${examId}-submissions.csv`,
): Promise<DownloadedCsvFile> => {
  const data: unknown = await exportExamSubmissionsCsvFromApi({
    parseAs: "blob",
    path: {
      id: examId,
    },
    throwOnError: true,
  })

  if (!(data instanceof Blob)) {
    throw new Error("Invalid exam submissions CSV response")
  }

  return {
    blob: data,
    fileName,
  }
}
