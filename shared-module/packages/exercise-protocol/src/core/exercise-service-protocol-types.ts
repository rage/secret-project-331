import { GradingRequest, GradingResult } from "./exercise-service-protocol-types-2"
import { isSetStateMessage } from "./exercise-service-protocol-types.guard"
import { ExerciseTaskGradingResult, RepositoryExercise, UserInfo } from "./exerciseServiceTypes"

/**
 * from: IFrame
 *
 * to: parent
 */
export type MessageFromIframe =
  | CurrentStateMessage
  | HeightChangedMessage
  | FileUploadMessage
  | RequestRepositoryExercisesMessage
  | RequestIframeReloadMessage
  | OpenDialogMessage

export interface CurrentStateMessage {
  message: "current-state"
  data: unknown // { private_spec: unknown } | { public_spec: unknown } ?
  valid: boolean
}

export interface HeightChangedMessage {
  message: "height-changed"
  data: number
}

export interface OpenLinkMessage {
  message: "open-link"
  data: string
}

/**
 * Asks the parent to upload files on the exercise's behalf (plugins never store data themselves —
 * the host owns storage). The parent answers with an `UploadResultMessage` carrying the same
 * `requestId`; the exercise then records the returned URLs in its `answer`. This mirrors the
 * `OpenDialogMessage`/`DialogResponseMessage` request/response pattern, so several uploads can be in
 * flight at once. Prefer the `ParentUploadClient` engine (`exercise-client`) or the `useFileUpload`
 * hook (`exercise-react`) over hand-rolling it.
 *
 * Note: unrelated to `SpecRequest.upload_url`, which is a server-side upload URL used by the
 * spec-generator endpoints, not this client-side message flow.
 */
export interface FileUploadMessage {
  message: "file-upload"
  /**
   * Correlation id the parent echoes back in the matching `UploadResultMessage`. Optional for
   * backward compatibility with callers that predate correlation (they can only have one upload in
   * flight at a time).
   */
  requestId?: string | null
  /** Files to upload, keyed by name. Sent as a JS `Map` (structured-clone), not a plain object. */
  files: Map<string, string | Blob>
}

export interface RequestRepositoryExercisesMessage {
  message: "request-repository-exercises"
}

export interface RequestIframeReloadMessage {
  message: "request-iframe-reload"
}

/**
 * Asks the parent to open a modal dialog and report back what the user chose. This is the
 * protocol's request/response message: the parent answers with a `DialogResponseMessage`
 * carrying the same `requestId`. The exercise supplies already-localized strings (it owns its
 * own i18n and knows the active language), so the parent dialog is a generic renderer.
 */
export interface OpenDialogMessage {
  message: "open-dialog"
  /** Correlation id the parent echoes back in the matching `DialogResponseMessage`. */
  requestId: string
  /**
   * "confirm" shows confirm + cancel buttons and resolves to the user's choice.
   * "warning" shows a single acknowledge button and resolves to `true` once dismissed.
   */
  dialogType: "confirm" | "warning"
  title: string
  /** Body paragraphs; each entry is rendered as its own paragraph. */
  body: string[]
  /** Already-localized confirm/acknowledge button label; parent uses a generic default if omitted. */
  confirmButtonLabel?: string | null
  /** Already-localized cancel button label (only used for "confirm" dialogs). */
  cancelButtonLabel?: string | null
}

/**
 * from: Parent
 *
 * to: IFrame
 */
export type MessageToIframe =
  | SetLanguageMessage
  | SetStateMessage
  | UploadResultMessage
  | RepositoryExercisesMessage
  | TestResultsMessage
  | DialogResponseMessage

export interface SetLanguageMessage {
  message: "set-language"
  // e.g. "en" or "fi"
  data: string
}

export type SetStateMessage = {
  message: "set-state"
} & ExtendedIframeState

/**
 * The parent's reply to a `FileUploadMessage`, correlated by `requestId`. On success carries the
 * stored files as a JS `Map<name, url>` (structured-clone, not a plain object); on failure an error
 * string.
 */
export type UploadResultMessage = {
  message: "upload-result"
  /** Matches the `requestId` of the `FileUploadMessage` this responds to (when the caller sent one). */
  requestId?: string | null
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

export type RepositoryExercisesMessage = {
  message: "repository-exercises"
  repository_exercises: Array<RepositoryExercise>
}

export type TestResultsMessage = {
  message: "test-results"
  test_result: unknown
}

/** The parent's response to an `OpenDialogMessage`, correlated by `requestId`. */
export interface DialogResponseMessage {
  message: "dialog-response"
  /** Matches the `requestId` of the `OpenDialogMessage` this responds to. */
  requestId: string
  /** For "confirm": whether the user confirmed. For "warning": always `true` (acknowledged). */
  confirmed: boolean
}

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

export type CustomViewIframeState = {
  view_type: "custom-view"
  user_information: UserInfo
  user_variables?: UserVariablesMap | null
  course_name: string
  module_completion_date: string | null
  data: {
    submissions_by_exercise: Array<{
      exercise_id: string
      exercise_name: string
      exercise_tasks: Array<{
        task_id: string
        public_spec: unknown
        user_answer: unknown
        grading: unknown
      }>
    }>
  }
}

/** Defines the allowed data formats for the set-state-message */
export type ExerciseIframeState =
  AnswerExerciseIframeState | ViewSubmissionIframeState | ExerciseEditorIframeState

export type ExtendedIframeState = ExerciseIframeState | CustomViewIframeState

export type IframeViewType = ExerciseIframeState["view_type"]

// To workaround a bug in ts-auto-guard
export type NonGenericGradingRequest = GradingRequest<unknown, unknown>

export type NonGenericGradingResult = GradingResult<unknown>
