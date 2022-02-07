/* eslint-disable i18next/no-literal-string */
import { CourseMaterialExerciseTask, SubmissionResult } from "../shared-module/bindings"
import { IframeState } from "../shared-module/iframe-protocol-types"

export interface ExerciseDownloadedAction {
  type: "exerciseDownloaded"
  payload: Array<CourseMaterialExerciseTask>
}

export interface SubmissionGradedAction {
  type: "submissionGraded"
  payload: Array<{
    submissionResult: SubmissionResult
    publicSpec: unknown
  }>
}

export interface TryAgain {
  type: "tryAgain"
  payload: Array<CourseMaterialExerciseTask>
}

export type PostThisStateToIFrameAction =
  | ExerciseDownloadedAction
  | SubmissionGradedAction
  | TryAgain

export default function exerciseBlockPostThisStateToIFrameReducer(
  prev: Array<IframeState> | null,
  action: PostThisStateToIFrameAction,
): Array<IframeState> | null {
  switch (action.type) {
    case "exerciseDownloaded":
      return action.payload.map<IframeState>((exerciseTask) => {
        const prevExerciseTask = prev?.find((x) => x.exercise_task_id === exerciseTask.id)
        if (prevExerciseTask && prevExerciseTask?.view_type === "view-submission") {
          return prevExerciseTask
        } else if (exerciseTask.previous_submission) {
          return {
            view_type: "view-submission",
            exercise_task_id: exerciseTask.id,
            data: {
              public_spec: exerciseTask.public_spec,
              model_solution_spec: exerciseTask.model_solution_spec,
              grading: null,
              user_answer: null,
            },
          }
        }
        return {
          view_type: "exercise",
          exercise_task_id: exerciseTask.id,
          data: {
            public_spec: exerciseTask.public_spec,
            previous_submission: exerciseTask.previous_submission,
          },
        }
      })
    case "submissionGraded": {
      return action.payload.map((submissionResult) => {
        return {
          view_type: "view-submission",
          exercise_task_id: submissionResult.submissionResult.submission.exercise_task_id,
          data: {
            grading: submissionResult.submissionResult.grading,
            model_solution_spec: submissionResult.submissionResult.model_solution_spec,
            public_spec: submissionResult.publicSpec,
            user_answer: submissionResult.submissionResult.submission.data_json,
          },
        }
      })
    }
    case "tryAgain": {
      return action.payload.map((x) => ({
        view_type: "exercise",
        exercise_task_id: x.id,
        data: {
          public_spec: x.public_spec,
          previous_submission: x.previous_submission,
        },
      }))
    }
  }
}
