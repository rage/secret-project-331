/* eslint-disable i18next/no-literal-string */
import {
  CourseMaterialExerciseTask,
  StudentExerciseSlideSubmissionResult,
} from "../shared-module/bindings"
import { IframeState } from "../shared-module/exercise-service-protocol-types"
import getGuestPseudonymousUserId from "../shared-module/utils/getGuestPseudonymousUserId"
import { exerciseTaskGradingToExerciseTaskGradingResult } from "../shared-module/utils/typeMappter"

export interface ExerciseDownloadedAction {
  type: "exerciseDownloaded"
  payload: Array<CourseMaterialExerciseTask>
  signedIn: boolean
}

export interface SubmissionGradedAction {
  type: "submissionGraded"
  payload: StudentExerciseSlideSubmissionResult
  signedIn: boolean
}

export interface TryAgain {
  type: "tryAgain"
  payload: Array<CourseMaterialExerciseTask>
  signedIn: boolean
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
              user_information: {
                pseudonymous_id: exerciseTask.pseudonumous_user_id ?? getGuestPseudonymousUserId(),
                signed_in: action.signedIn,
              },
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
            view_type: "exercise",
            exercise_task_id: exerciseTask.id,
            user_information: {
              pseudonymous_id: exerciseTask.pseudonumous_user_id ?? getGuestPseudonymousUserId(),
              signed_in: action.signedIn,
            },
            data: {
              public_spec: exerciseTask.public_spec,
              previous_submission: exerciseTask.previous_submission,
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
          user_information: {
            pseudonymous_id:
              prevTask?.user_information.pseudonymous_id ?? getGuestPseudonymousUserId(), // Should we use the getGuestPseudonymousUserId() function here? I think the case where we would not find the previous task does not happen in practice.
            signed_in: action.signedIn,
          },
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
        view_type: "exercise",
        exercise_task_id: x.id,
        user_information: {
          pseudonymous_id: x.pseudonumous_user_id ?? getGuestPseudonymousUserId(),
          signed_in: action.signedIn,
        },
        data: {
          public_spec: x.public_spec,
          previous_submission: x.previous_submission,
        },
      }))
    }
  }
}
