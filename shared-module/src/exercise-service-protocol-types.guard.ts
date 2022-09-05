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

export function isCurrentStateMessage(obj: unknown): obj is CurrentStateMessage {
  const typedObj = obj as CurrentStateMessage
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typedObj["message"] === "current-state" &&
    typeof typedObj["valid"] === "boolean"
  )
}

export function isHeightChangedMessage(obj: unknown): obj is HeightChangedMessage {
  const typedObj = obj as HeightChangedMessage
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typedObj["message"] === "height-changed" &&
    typeof typedObj["data"] === "number"
  )
}

export function isReadyMessage(obj: unknown): obj is ReadyMessage {
  const typedObj = obj as ReadyMessage
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typedObj["message"] === "ready"
  )
}

export function isSetLanguageMessage(obj: unknown): obj is SetLanguageMessage {
  const typedObj = obj as SetLanguageMessage
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typedObj["message"] === "set-language" &&
    typeof typedObj["data"] === "string"
  )
}

export function isSetStateMessage(obj: unknown): obj is SetStateMessage {
  const typedObj = obj as SetStateMessage
  return (
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["message"] === "set-state" &&
      ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["view_type"] === "answer-exercise" &&
      typeof typedObj["exercise_task_id"] === "string" &&
      (isUserInformation(typedObj["user_information"]) as boolean) &&
      ((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
        typeof typedObj["data"] === "function")) ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["message"] === "set-state" &&
      ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["view_type"] === "view-submission" &&
      typeof typedObj["exercise_task_id"] === "string" &&
      (isUserInformation(typedObj["user_information"]) as boolean) &&
      ((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
        typeof typedObj["data"] === "function") &&
      (typedObj["data"]["grading"] === null ||
        (((typedObj["data"]["grading"] !== null &&
          typeof typedObj["data"]["grading"] === "object") ||
          typeof typedObj["data"]["grading"] === "function") &&
          (typedObj["data"]["grading"]["grading_progress"] === "Failed" ||
            typedObj["data"]["grading"]["grading_progress"] === "NotReady" ||
            typedObj["data"]["grading"]["grading_progress"] === "PendingManual" ||
            typedObj["data"]["grading"]["grading_progress"] === "Pending" ||
            typedObj["data"]["grading"]["grading_progress"] === "FullyGraded") &&
          typeof typedObj["data"]["grading"]["score_given"] === "number" &&
          typeof typedObj["data"]["grading"]["score_maximum"] === "number" &&
          (typedObj["data"]["grading"]["feedback_text"] === null ||
            typeof typedObj["data"]["grading"]["feedback_text"] === "string")))) ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["message"] === "set-state" &&
      ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["view_type"] === "exercise-editor" &&
      typeof typedObj["exercise_task_id"] === "string" &&
      (isUserInformation(typedObj["user_information"]) as boolean) &&
      ((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
        typeof typedObj["data"] === "function") &&
      (typeof typedObj["data"]["repository_exercise"] === "undefined" ||
        (((typedObj["data"]["repository_exercise"] !== null &&
          typeof typedObj["data"]["repository_exercise"] === "object") ||
          typeof typedObj["data"]["repository_exercise"] === "function") &&
          typeof typedObj["data"]["repository_exercise"]["id"] === "string" &&
          typeof typedObj["data"]["repository_exercise"]["repository_id"] === "string" &&
          typeof typedObj["data"]["repository_exercise"]["part"] === "string" &&
          typeof typedObj["data"]["repository_exercise"]["name"] === "string" &&
          typeof typedObj["data"]["repository_exercise"]["repository_url"] === "string" &&
          Array.isArray(typedObj["data"]["repository_exercise"]["checksum"]) &&
          typedObj["data"]["repository_exercise"]["checksum"].every(
            (e: any) => typeof e === "number",
          ) &&
          typeof typedObj["data"]["repository_exercise"]["download_url"] === "string")))
  )
}

export function isUserInformation(obj: unknown): obj is UserInformation {
  const typedObj = obj as UserInformation
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["pseudonymous_id"] === "string" &&
    typeof typedObj["signed_in"] === "boolean"
  )
}

export function isIframeState(obj: unknown): obj is IframeState {
  const typedObj = obj as IframeState
  return (
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["view_type"] === "answer-exercise" &&
      typeof typedObj["exercise_task_id"] === "string" &&
      (isUserInformation(typedObj["user_information"]) as boolean) &&
      ((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
        typeof typedObj["data"] === "function")) ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["view_type"] === "view-submission" &&
      typeof typedObj["exercise_task_id"] === "string" &&
      (isUserInformation(typedObj["user_information"]) as boolean) &&
      ((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
        typeof typedObj["data"] === "function") &&
      (typedObj["data"]["grading"] === null ||
        (((typedObj["data"]["grading"] !== null &&
          typeof typedObj["data"]["grading"] === "object") ||
          typeof typedObj["data"]["grading"] === "function") &&
          (typedObj["data"]["grading"]["grading_progress"] === "Failed" ||
            typedObj["data"]["grading"]["grading_progress"] === "NotReady" ||
            typedObj["data"]["grading"]["grading_progress"] === "PendingManual" ||
            typedObj["data"]["grading"]["grading_progress"] === "Pending" ||
            typedObj["data"]["grading"]["grading_progress"] === "FullyGraded") &&
          typeof typedObj["data"]["grading"]["score_given"] === "number" &&
          typeof typedObj["data"]["grading"]["score_maximum"] === "number" &&
          (typedObj["data"]["grading"]["feedback_text"] === null ||
            typeof typedObj["data"]["grading"]["feedback_text"] === "string")))) ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["view_type"] === "exercise-editor" &&
      typeof typedObj["exercise_task_id"] === "string" &&
      (isUserInformation(typedObj["user_information"]) as boolean) &&
      ((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
        typeof typedObj["data"] === "function") &&
      (typeof typedObj["data"]["repository_exercise"] === "undefined" ||
        (((typedObj["data"]["repository_exercise"] !== null &&
          typeof typedObj["data"]["repository_exercise"] === "object") ||
          typeof typedObj["data"]["repository_exercise"] === "function") &&
          typeof typedObj["data"]["repository_exercise"]["id"] === "string" &&
          typeof typedObj["data"]["repository_exercise"]["repository_id"] === "string" &&
          typeof typedObj["data"]["repository_exercise"]["part"] === "string" &&
          typeof typedObj["data"]["repository_exercise"]["name"] === "string" &&
          typeof typedObj["data"]["repository_exercise"]["repository_url"] === "string" &&
          Array.isArray(typedObj["data"]["repository_exercise"]["checksum"]) &&
          typedObj["data"]["repository_exercise"]["checksum"].every(
            (e: any) => typeof e === "number",
          ) &&
          typeof typedObj["data"]["repository_exercise"]["download_url"] === "string")))
  )
}

export function isIframeViewType(obj: unknown): obj is IframeViewType {
  const typedObj = obj as IframeViewType
  return (
    typedObj === "answer-exercise" ||
    typedObj === "view-submission" ||
    typedObj === "exercise-editor"
  )
}
