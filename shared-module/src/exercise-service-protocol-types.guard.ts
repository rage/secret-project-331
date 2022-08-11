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
      obj.view_type === "exercise" &&
      typeof obj.exercise_task_id === "string" &&
      ((obj.data !== null && typeof obj.data === "object") || typeof obj.data === "function") &&
      (obj.data.previous_submission === null ||
        (((obj.data.previous_submission !== null &&
          typeof obj.data.previous_submission === "object") ||
          typeof obj.data.previous_submission === "function") &&
          typeof obj.data.previous_submission.id === "string" &&
          obj.data.previous_submission.created_at instanceof Date &&
          obj.data.previous_submission.updated_at instanceof Date &&
          (obj.data.previous_submission.deleted_at === null ||
            obj.data.previous_submission.deleted_at instanceof Date) &&
          typeof obj.data.previous_submission.exercise_slide_submission_id === "string" &&
          typeof obj.data.previous_submission.exercise_task_id === "string" &&
          typeof obj.data.previous_submission.exercise_slide_id === "string" &&
          (obj.data.previous_submission.exercise_task_grading_id === null ||
            typeof obj.data.previous_submission.exercise_task_grading_id === "string")))) ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.message === "set-state" &&
      ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.view_type === "view-submission" &&
      typeof obj.exercise_task_id === "string" &&
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
      ((obj.data !== null && typeof obj.data === "object") || typeof obj.data === "function"))
  )
}

export function isIframeState(obj: any, _argumentName?: string): obj is IframeState {
  return (
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.view_type === "exercise" &&
      typeof obj.exercise_task_id === "string" &&
      ((obj.data !== null && typeof obj.data === "object") || typeof obj.data === "function") &&
      (obj.data.previous_submission === null ||
        (((obj.data.previous_submission !== null &&
          typeof obj.data.previous_submission === "object") ||
          typeof obj.data.previous_submission === "function") &&
          typeof obj.data.previous_submission.id === "string" &&
          obj.data.previous_submission.created_at instanceof Date &&
          obj.data.previous_submission.updated_at instanceof Date &&
          (obj.data.previous_submission.deleted_at === null ||
            obj.data.previous_submission.deleted_at instanceof Date) &&
          typeof obj.data.previous_submission.exercise_slide_submission_id === "string" &&
          typeof obj.data.previous_submission.exercise_task_id === "string" &&
          typeof obj.data.previous_submission.exercise_slide_id === "string" &&
          (obj.data.previous_submission.exercise_task_grading_id === null ||
            typeof obj.data.previous_submission.exercise_task_grading_id === "string")))) ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.view_type === "view-submission" &&
      typeof obj.exercise_task_id === "string" &&
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
      ((obj.data !== null && typeof obj.data === "object") || typeof obj.data === "function"))
  )
}

export function isIframeViewType(obj: any, _argumentName?: string): obj is IframeViewType {
  return obj === "exercise" || obj === "view-submission" || obj === "exercise-editor"
}
