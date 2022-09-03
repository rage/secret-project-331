/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

/*
 * Generated type guards for "exercise-service-protocol-types.ts".
 * WARNING: Do not manually change this file.
 */
import {
  CurrentStateMessage,
  HeightChangedMessage,
  IframeState,
  IframeViewType,
  ReadyMessage,
  SetLanguageMessage,
  SetStateMessage,
  UserInformation,
} from "./exercise-service-protocol-types"

export function isCurrentStateMessage(
  obj: any,
  _argumentName?: string,
): obj is CurrentStateMessage {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    obj.message === "current-state" &&
    typeof obj.valid === "boolean"
  )
}

export function isHeightChangedMessage(
  obj: any,
  _argumentName?: string,
): obj is HeightChangedMessage {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    obj.message === "height-changed" &&
    typeof obj.data === "number"
  )
}

export function isReadyMessage(obj: any, _argumentName?: string): obj is ReadyMessage {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    obj.message === "ready"
  )
}

export function isSetLanguageMessage(obj: any, _argumentName?: string): obj is SetLanguageMessage {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    obj.message === "set-language" &&
    typeof obj.data === "string"
  )
}

export function isSetStateMessage(obj: any, _argumentName?: string): obj is SetStateMessage {
  return (
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.message === "set-state" &&
      ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.view_type === "answer-exercise" &&
      typeof obj.exercise_task_id === "string" &&
      (isUserInformation(obj.user_information) as boolean) &&
      ((obj.data !== null && typeof obj.data === "object") || typeof obj.data === "function")) ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.message === "set-state" &&
      ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.view_type === "view-submission" &&
      typeof obj.exercise_task_id === "string" &&
      (isUserInformation(obj.user_information) as boolean) &&
      ((obj.data !== null && typeof obj.data === "object") || typeof obj.data === "function") &&
      (obj.data.grading === null ||
        (((obj.data.grading !== null && typeof obj.data.grading === "object") ||
          typeof obj.data.grading === "function") &&
          (obj.data.grading.grading_progress === "Failed" ||
            obj.data.grading.grading_progress === "NotReady" ||
            obj.data.grading.grading_progress === "PendingManual" ||
            obj.data.grading.grading_progress === "Pending" ||
            obj.data.grading.grading_progress === "FullyGraded") &&
          typeof obj.data.grading.score_given === "number" &&
          typeof obj.data.grading.score_maximum === "number" &&
          (obj.data.grading.feedback_text === null ||
            typeof obj.data.grading.feedback_text === "string")))) ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.message === "set-state" &&
      ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.view_type === "exercise-editor" &&
      typeof obj.exercise_task_id === "string" &&
      (isUserInformation(obj.user_information) as boolean) &&
      ((obj.data !== null && typeof obj.data === "object") || typeof obj.data === "function") &&
      (typeof obj.data.repository_exercise === "undefined" ||
        (((obj.data.repository_exercise !== null &&
          typeof obj.data.repository_exercise === "object") ||
          typeof obj.data.repository_exercise === "function") &&
          typeof obj.data.repository_exercise.id === "string" &&
          typeof obj.data.repository_exercise.repository_id === "string" &&
          typeof obj.data.repository_exercise.part === "string" &&
          typeof obj.data.repository_exercise.name === "string" &&
          typeof obj.data.repository_exercise.repository_url === "string" &&
          Array.isArray(obj.data.repository_exercise.checksum) &&
          obj.data.repository_exercise.checksum.every((e: any) => typeof e === "number") &&
          typeof obj.data.repository_exercise.download_url === "string")))
  )
}

export function isUserInformation(obj: any, _argumentName?: string): obj is UserInformation {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.pseudonymous_id === "string" &&
    typeof obj.signed_in === "boolean"
  )
}

export function isIframeState(obj: any, _argumentName?: string): obj is IframeState {
  return (
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.view_type === "answer-exercise" &&
      typeof obj.exercise_task_id === "string" &&
      (isUserInformation(obj.user_information) as boolean) &&
      ((obj.data !== null && typeof obj.data === "object") || typeof obj.data === "function")) ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.view_type === "view-submission" &&
      typeof obj.exercise_task_id === "string" &&
      (isUserInformation(obj.user_information) as boolean) &&
      ((obj.data !== null && typeof obj.data === "object") || typeof obj.data === "function") &&
      (obj.data.grading === null ||
        (((obj.data.grading !== null && typeof obj.data.grading === "object") ||
          typeof obj.data.grading === "function") &&
          (obj.data.grading.grading_progress === "Failed" ||
            obj.data.grading.grading_progress === "NotReady" ||
            obj.data.grading.grading_progress === "PendingManual" ||
            obj.data.grading.grading_progress === "Pending" ||
            obj.data.grading.grading_progress === "FullyGraded") &&
          typeof obj.data.grading.score_given === "number" &&
          typeof obj.data.grading.score_maximum === "number" &&
          (obj.data.grading.feedback_text === null ||
            typeof obj.data.grading.feedback_text === "string")))) ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.view_type === "exercise-editor" &&
      typeof obj.exercise_task_id === "string" &&
      (isUserInformation(obj.user_information) as boolean) &&
      ((obj.data !== null && typeof obj.data === "object") || typeof obj.data === "function") &&
      (typeof obj.data.repository_exercise === "undefined" ||
        (((obj.data.repository_exercise !== null &&
          typeof obj.data.repository_exercise === "object") ||
          typeof obj.data.repository_exercise === "function") &&
          typeof obj.data.repository_exercise.id === "string" &&
          typeof obj.data.repository_exercise.repository_id === "string" &&
          typeof obj.data.repository_exercise.part === "string" &&
          typeof obj.data.repository_exercise.name === "string" &&
          typeof obj.data.repository_exercise.repository_url === "string" &&
          Array.isArray(obj.data.repository_exercise.checksum) &&
          obj.data.repository_exercise.checksum.every((e: any) => typeof e === "number") &&
          typeof obj.data.repository_exercise.download_url === "string")))
  )
}

export function isIframeViewType(obj: any, _argumentName?: string): obj is IframeViewType {
  return obj === "answer-exercise" || obj === "view-submission" || obj === "exercise-editor"
}
