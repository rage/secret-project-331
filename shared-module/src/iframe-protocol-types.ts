import { Grading, Submission } from "./bindings"

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
 * from: parent
 *
 * to: IFrame
 */
export type SetStateMessage = { message: "set-state" } & IframeState

export type IframeState =
  | {
      view_type: "exercise"
      data: {
        public_spec: unknown
        previous_submission: Submission | null
      }
    }
  | {
      view_type: "view-submission"
      data: {
        grading: Grading | null
        user_answer: unknown
        public_spec: unknown
        model_solution_spec: unknown
      }
    }
  | {
      view_type: "exercise-editor"
      data: { private_spec: unknown }
    }
