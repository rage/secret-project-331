/* eslint-disable i18next/no-literal-string */
import {
  CourseMaterialExercise,
  StudentExerciseSlideSubmissionResult,
  UserCourseInstanceExerciseServiceVariable,
} from "../shared-module/bindings"
import { IframeState, UserVariablesMap } from "../shared-module/exercise-service-protocol-types"
import getGuestPseudonymousUserId from "../shared-module/utils/getGuestPseudonymousUserId"
import { exerciseTaskGradingToExerciseTaskGradingResult } from "../shared-module/utils/typeMappter"

export interface ExerciseDownloadedAction {
  type: "exerciseDownloaded"
  payload: CourseMaterialExercise
  signedIn: boolean
}

export interface SubmissionGradedAction {
  type: "submissionGraded"
  payload: StudentExerciseSlideSubmissionResult
  signedIn: boolean
}

export interface TryAgain {
  type: "tryAgain"
  payload: CourseMaterialExercise
  signedIn: boolean
}

export type PostThisStateToIFrameAction =
  | ExerciseDownloadedAction
  | SubmissionGradedAction
  | TryAgain

function userVariableListToMap(
  list: UserCourseInstanceExerciseServiceVariable[],
): UserVariablesMap {
  const res: UserVariablesMap = {}
  list.forEach((item) => (res[item.variable_key] = item.variable_value))
  return res
}

export default function exerciseBlockPostThisStateToIFrameReducer(
  prev: Array<IframeState> | null,
  action: PostThisStateToIFrameAction,
): Array<IframeState> | null {
  switch (action.type) {
    case "exerciseDownloaded": {
      const exerciseTasks = action.payload.current_exercise_slide.exercise_tasks
      return exerciseTasks
        .sort((a, b) => a.order_number - b.order_number)
        .map<IframeState>((exerciseTask) => {
          const prevExerciseTask = prev?.find((x) => x.exercise_task_id === exerciseTask.id)
          const userVariables = userVariableListToMap(
            action.payload.user_course_instance_exercise_service_variables.filter(
              (variable) => variable.exercise_service_slug === exerciseTask.exercise_service_slug,
            ),
          )
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
              user_variables: userVariables,
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
            user_information: {
              pseudonymous_id: exerciseTask.pseudonumous_user_id ?? getGuestPseudonymousUserId(),
              signed_in: action.signedIn,
            },
            user_variables: userVariables,
            data: {
              public_spec: exerciseTask.public_spec,
              // Checked that this does not exist in the else if above.
              previous_submission: null,
            },
          }
        })
    }
    case "submissionGraded": {
      return action.payload.exercise_task_submission_results.map((submissionResult) => {
        const prevTask = prev?.find(
          (x) => x.exercise_task_id === submissionResult.submission.exercise_task_id,
        )
        const userVariables = userVariableListToMap(
          action.payload.user_course_instance_exercise_service_variables.filter(
            (variable) =>
              variable.exercise_service_slug ===
              submissionResult.exercise_task_exercise_service_slug,
          ),
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
          user_variables: userVariables,
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
      const exerciseTasks = action.payload.current_exercise_slide.exercise_tasks

      return exerciseTasks.map((exerciseTask) => {
        const userVariables = userVariableListToMap(
          action.payload.user_course_instance_exercise_service_variables.filter(
            (variable) => variable.exercise_service_slug === exerciseTask.exercise_service_slug,
          ),
        )
        return {
          view_type: "answer-exercise",
          exercise_task_id: exerciseTask.id,
          user_information: {
            pseudonymous_id: exerciseTask.pseudonumous_user_id ?? getGuestPseudonymousUserId(),
            signed_in: action.signedIn,
          },
          user_variables: userVariables,
          data: {
            public_spec: exerciseTask.public_spec,
            previous_submission: exerciseTask.previous_submission?.data_json ?? null,
          },
        }
      })
    }
  }
}
