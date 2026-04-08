import { queryOptions, UseMutationOptions } from "@tanstack/react-query"

import {
  getExamUserExerciseStateInfoOptions as getExamUserExerciseStateInfoGeneratedOptions,
  getExerciseSlideSubmissionInfoOptions as getExerciseSlideSubmissionInfoGeneratedOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import { addTeacherGradingForExamSubmission as addTeacherGradingForExamSubmissionFromApi } from "@/generated/api/sdk.generated"
import type {
  CourseMaterialExerciseTask as GeneratedCourseMaterialExerciseTask,
  Exercise as GeneratedExercise,
  ExerciseSlideSubmission as GeneratedExerciseSlideSubmission,
  ExerciseSlideSubmissionInfo as GeneratedExerciseSlideSubmissionInfo,
  ExerciseTaskGrading as GeneratedExerciseTaskGrading,
  ExerciseTaskSubmission as GeneratedExerciseTaskSubmission,
  TeacherGradingDecision as GeneratedTeacherGradingDecision,
  UserExerciseState as GeneratedUserExerciseState,
} from "@/generated/api/types.generated"
import type {
  CourseMaterialExerciseTask,
  Exercise,
  ExerciseSlideSubmission,
  ExerciseSlideSubmissionInfo,
  ExerciseTaskGrading,
  ExerciseTaskSubmission,
  NewTeacherGradingDecision,
  TeacherGradingDecision,
  UserExerciseState,
} from "@/shared-module/common/bindings"

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

const normalizeExerciseTaskSubmission = (
  submission: GeneratedExerciseTaskSubmission,
): ExerciseTaskSubmission => ({
  ...submission,
  data_json: submission.data_json ?? null,
  deleted_at: submission.deleted_at ?? null,
  exercise_task_grading_id: submission.exercise_task_grading_id ?? null,
  metadata: submission.metadata ?? null,
})

const normalizeExerciseTaskGrading = (
  grading: GeneratedExerciseTaskGrading,
): ExerciseTaskGrading => ({
  ...grading,
  course_id: grading.course_id ?? null,
  deleted_at: grading.deleted_at ?? null,
  exam_id: grading.exam_id ?? null,
  feedback_json: grading.feedback_json ?? null,
  feedback_text: grading.feedback_text ?? null,
  grading_completed_at: grading.grading_completed_at ?? null,
  grading_started_at: grading.grading_started_at ?? null,
  score_given: grading.score_given ?? null,
  unscaled_score_given: grading.unscaled_score_given ?? null,
  unscaled_score_maximum: grading.unscaled_score_maximum ?? null,
})

const normalizeCourseMaterialExerciseTask = (
  task: GeneratedCourseMaterialExerciseTask,
): CourseMaterialExerciseTask => ({
  ...task,
  deleted_at: task.deleted_at ?? null,
  exercise_iframe_url: task.exercise_iframe_url ?? null,
  model_solution_spec: task.model_solution_spec ?? null,
  previous_submission: task.previous_submission
    ? normalizeExerciseTaskSubmission(task.previous_submission)
    : null,
  previous_submission_grading: task.previous_submission_grading
    ? normalizeExerciseTaskGrading(task.previous_submission_grading)
    : null,
  pseudonumous_user_id: task.pseudonumous_user_id ?? null,
  public_spec: task.public_spec ?? null,
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

const normalizeExerciseSlideSubmissionInfo = (
  submissionInfo: GeneratedExerciseSlideSubmissionInfo,
): ExerciseSlideSubmissionInfo => ({
  exercise: normalizeExercise(submissionInfo.exercise),
  exercise_slide_submission: normalizeExerciseSlideSubmission(
    submissionInfo.exercise_slide_submission,
  ),
  tasks: submissionInfo.tasks.map(normalizeCourseMaterialExerciseTask),
  user_exercise_state: submissionInfo.user_exercise_state
    ? normalizeUserExerciseState(submissionInfo.user_exercise_state)
    : null,
})

type AddTeacherGradingForExamSubmissionVariables = {
  body: NewTeacherGradingDecision
}

export const getSubmissionInfoOptions = (submissionId: string) =>
  queryOptions({
    ...getExerciseSlideSubmissionInfoGeneratedOptions({
      path: {
        submission_id: submissionId,
      },
    }),
    select: (submissionInfo): ExerciseSlideSubmissionInfo =>
      normalizeExerciseSlideSubmissionInfo(submissionInfo),
  })

export const getGradingInfoOptions = (examId: string, exerciseId: string, userId: string) =>
  queryOptions({
    ...getExamUserExerciseStateInfoGeneratedOptions({
      path: {
        exam_id: examId,
      },
      query: {
        exercise_id: exerciseId,
        user_id: userId,
      },
    }),
    select: (userExerciseState): UserExerciseState => normalizeUserExerciseState(userExerciseState),
  })

export const addTeacherGradingForExamSubmissionMutationOptions = (): UseMutationOptions<
  TeacherGradingDecision,
  unknown,
  AddTeacherGradingForExamSubmissionVariables
> => ({
  mutationFn: async ({ body }) => {
    const result = await addTeacherGradingForExamSubmissionFromApi({
      body,
      throwOnError: true,
    })

    return normalizeTeacherGradingDecision(result)
  },
})
