/* eslint-disable i18next/no-literal-string */
import { ExerciseTaskGradingResult, RepositoryExercise } from "./bindings"
import { GradingRequest, GradingResult } from "./exercise-service-protocol-types-2"
import { isSetStateMessage } from "./exercise-service-protocol-types.guard"

/**
 * from: IFrame
 *
 * to: parent
 */
export type MessageFromIframe = CurrentStateMessage | HeightChangedMessage | FileUploadMessage

export interface CurrentStateMessage {
  message: "current-state"
  data: unknown // { private_spec: unknown } | { public_spec: unknown } ?
  valid: boolean
}

export interface HeightChangedMessage {
  message: "height-changed"
  data: number
}

export interface FileUploadMessage {
  message: "file-upload"
  files: Map<string, string | Blob>
}

/**
 * from: Parent
 *
 * to: IFrame
 */
export type MessageToIframe = SetLanguageMessage | SetStateMessage | UploadResultMessage

export interface SetLanguageMessage {
  message: "set-language"
  // e.g. "en" or "fi"
  data: string
}

export type SetStateMessage = {
  message: "set-state"
} & IframeState

export type UploadResultMessage = {
  message: "upload-result"
} & (
  | {
      success: true
      urls: Map<string, string>
    }
  | {
      success: false
      error: string
    }
)

/**
 * Checks if the message is a set state messages but doesn't require all the fields in the object to match
 * the type. Won't fail if the set state message gets extended but still checks whether the message is
 * intended to be the right kind of message.
 */
export function forgivingIsSetStateMessage(obj: unknown): obj is SetStateMessage {
  if (isSetStateMessage(obj)) {
    // Passes the stricter check, all is good.
    return true
  }

  const typedObj = obj as SetStateMessage
  const forgivingCheck =
    typedObj !== null && typeof typedObj === "object" && typedObj["message"] === "set-state"
  if (forgivingCheck === true) {
    console.warn(
      `Message did not pass the strict set-state message check, but it did have the message field "set-state", so treating the object as a set-state message. However, we don't gurantee all fields in the object will match the type. If this has happened because the set-state message has been extended with more fields, everything is ok.`,
    )
  }
  return forgivingCheck
}

export type UserInformation = {
  pseudonymous_id: string
  signed_in: boolean
}

export type UserVariablesMap = { [key: string]: unknown }

export type AnswerExerciseIframeState = {
  view_type: "answer-exercise"
  exercise_task_id: string
  user_information: UserInformation
  /** Variables set from this exercise service's grade endpoint, visible only to this user on this course instance. */
  user_variables?: UserVariablesMap | null
  data: {
    public_spec: unknown
    previous_submission: unknown | null
  }
}

export type ViewSubmissionIframeState = {
  view_type: "view-submission"
  exercise_task_id: string
  user_information: UserInformation
  /** Variables set from this exercise service's grade endpoint, visible only to this user on this course instance. */
  user_variables?: UserVariablesMap | null
  data: {
    grading: ExerciseTaskGradingResult | null
    user_answer: unknown
    public_spec: unknown
    model_solution_spec: unknown
  }
}

export type ExerciseEditorIframeState = {
  view_type: "exercise-editor"
  exercise_task_id: string
  user_information: UserInformation
  repository_exercises?: Array<RepositoryExercise>
  data: { private_spec: unknown }
}

/** Defines the allowed data formats for the set-state-message */
export type IframeState =
  | AnswerExerciseIframeState
  | ViewSubmissionIframeState
  | ExerciseEditorIframeState

export type IframeViewType = IframeState["view_type"]

// To workaround a bug in ts-auto-guard
export type NonGenericGradingRequest = GradingRequest<unknown, unknown>

export type NonGenericGradingResult = GradingResult<unknown>
