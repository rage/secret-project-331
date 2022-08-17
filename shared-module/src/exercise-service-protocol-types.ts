import { ExerciseTaskGradingResult } from "./bindings"

/**
 * from: IFrame
 *
 * to: parent
 */
export interface CurrentStateMessage {
  message: "current-state"
  data: unknown
  valid: boolean
}

/**
 * from: IFrame
 *
 * to: parent
 */
export interface HeightChangedMessage {
  message: "height-changed"
  data: number
}

/**
 * from: IFrame
 *
 * to: parent
 */
export interface ReadyMessage {
  message: "ready"
}

/**
 * from: Parent
 *
 * to: IFrame
 */
export interface SetLanguageMessage {
  message: "set-language"
  // e.g. "en" or "fi"
  data: string
}

/**
 * from: parent
 *
 * to: IFrame
 */
export type SetStateMessage = { message: "set-state" } & IframeState

export type UserInformation = {
  pseudonymous_id: string
  signed_in: boolean
}

export type IframeState =
  | {
      view_type: "answer-exercise"
      exercise_task_id: string
      user_information: UserInformation
      data: {
        public_spec: unknown
        previous_submission: unknown | null
      }
    }
  | {
      view_type: "view-submission"
      exercise_task_id: string
      user_information: UserInformation
      data: {
        grading: ExerciseTaskGradingResult | null
        user_answer: unknown
        public_spec: unknown
        model_solution_spec: unknown
      }
    }
  | {
      view_type: "exercise-editor"
      exercise_task_id: string
      user_information: UserInformation
      data: { private_spec: unknown }
    }

export type IframeViewType = IframeState["view_type"]
