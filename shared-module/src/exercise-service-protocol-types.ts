import { ExerciseTaskGradingResult, RepositoryExercise } from "./bindings"

/**
 * from: IFrame
 *
 * to: parent
 */
export type MessageFromIframe =
  | CurrentStateMessage
  | UploadFilesMessage
  | SetFileUploadsMessage
  | HeightChangedMessage

export interface CurrentStateMessage {
  message: "current-state"
  data: unknown
  valid: boolean
}

/// Informs the parent of files that the iframe may wish to upload later via UploadFilesMessage.
export interface SetFileUploadsMessage {
  message: "set-file-uploads"
  files: Map<string, string | Blob>
}

// Tells the parent to upload the files that have previously been sent via SetFileUploadsMessage.
export interface UploadFilesMessage {
  message: "upload-files"
}

export interface HeightChangedMessage {
  message: "height-changed"
  data: number
}

/**
 * from: Parent
 *
 * to: IFrame
 */
export type MessageToIframe = SetLanguageMessage | UploadResultMessage | SetStateMessage

export interface SetLanguageMessage {
  message: "set-language"
  // e.g. "en" or "fi"
  data: string
}

export type UploadResultMessage =
  | {
      message: "upload-result"
      success: true
      urls: Map<string, string>
    }
  | {
      message: "upload-result"
      success: false
      error: string
    }

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
      repository_exercises?: Array<RepositoryExercise>
      data: { private_spec: unknown }
    }

export type IframeViewType = IframeState["view_type"]
