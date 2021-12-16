/* eslint-disable i18next/no-literal-string */
import { CourseMaterialExercise, SubmissionResult } from "../shared-module/bindings"
import { IframeState } from "../shared-module/iframe-protocol-types"

export interface ExerciseDownloadedAction {
  type: "exerciseDownloaded"
  payload: CourseMaterialExercise
}

export interface SubmissionGradedAction {
  type: "submissionGraded"
  payload: {
    submissionResult: SubmissionResult
    publicSpec: unknown
  }
}

export interface TryAgain {
  type: "tryAgain"
  payload: CourseMaterialExercise
}

export type PostThisStateToIFrameAction =
  | ExerciseDownloadedAction
  | SubmissionGradedAction
  | TryAgain

export default function exerciseBlockPostThisStateToIFrameReducer(
  prev: IframeState | null,
  action: PostThisStateToIFrameAction,
): IframeState | null {
  switch (action.type) {
    case "exerciseDownloaded":
      if (prev?.view_type === "view-submission") {
        return prev
      }

      if (action.payload.previous_submission) {
        return {
          view_type: "view-submission",
          data: {
            grading: action.payload.grading,
            user_answer: action.payload.previous_submission.data_json,
            public_spec: action.payload.current_exercise_task.public_spec,
            model_solution_spec: action.payload.current_exercise_task.model_solution_spec,
          },
        }
      } else {
        return {
          view_type: "exercise",
          data: {
            public_spec: action.payload.current_exercise_task.public_spec,
            previous_submission: action.payload.previous_submission,
          },
        }
      }
    case "submissionGraded": {
      return {
        view_type: "view-submission",
        data: {
          grading: action.payload.submissionResult.grading,
          user_answer: action.payload.submissionResult.submission.data_json,
          public_spec: action.payload.publicSpec,
          model_solution_spec: action.payload.submissionResult.model_solution_spec,
        },
      }
    }
    case "tryAgain": {
      return {
        view_type: "exercise",
        data: {
          public_spec: action.payload.current_exercise_task.public_spec,
          previous_submission: action.payload.previous_submission,
        },
      }
    }
  }
}
