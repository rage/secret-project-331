/* eslint-disable i18next/no-literal-string */
import {
  CourseMaterialExerciseTask,
  StudentExerciseSlideSubmissionResult,
} from "../shared-module/bindings"
import { IframeState } from "../shared-module/exercise-service-protocol-types"
import { exerciseTaskGradingToExerciseTaskGradingResult } from "../shared-module/utils/typeMappter"

export interface ExerciseDownloadedAction {
  type: "exerciseDownloaded"
  payload: Array<CourseMaterialExerciseTask>
}

export interface SubmissionGradedAction {
  type: "submissionGraded"
  payload: StudentExerciseSlideSubmissionResult
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
      return action.payload
        .sort((a, b) => a.order_number - b.order_number)
        .map<IframeState>((exerciseTask) => {
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
                grading: exerciseTaskGradingToExerciseTaskGradingResult(
                  exerciseTask.previous_submission_grading,
                ),
                user_answer: exerciseTask.previous_submission.data_json,
              },
            }
          }
          return {
            view_type: "answer-exercise",
            exercise_task_id: exerciseTask.id,
            data: {
              public_spec: exerciseTask.public_spec,
              // Checked that this does not exist in the else if above.
              previous_submission: null,
            },
          }
        })
    case "submissionGraded": {
      return action.payload.exercise_task_submission_results.map((submissionResult) => {
        const prevTask = prev?.find(
          (x) => x.exercise_task_id === submissionResult.submission.exercise_task_id,
        )
        const public_spec =
          !prevTask || prevTask.view_type === "exercise-editor" ? null : prevTask.data.public_spec
        return {
          view_type: "view-submission",
          exercise_task_id: submissionResult.submission.exercise_task_id,
          data: {
            grading: exerciseTaskGradingToExerciseTaskGradingResult(submissionResult.grading),
            model_solution_spec: submissionResult.model_solution_spec,
            public_spec,
            user_answer: submissionResult.submission.data_json,
          },
        }
      })
    }
    case "tryAgain": {
      return action.payload.map((x) => ({
        view_type: "answer-exercise",
        exercise_task_id: x.id,
        data: {
          public_spec: x.public_spec,
          previous_submission: x.previous_submission?.data_json ?? null,
        },
      }))
    }
  }
}
