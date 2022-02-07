/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

/*
 * Generated type guards for "iframe-protocol-types.ts".
 * WARNING: Do not manually change this file.
 */
import {
  CurrentStateMessage,
  HeightChangedMessage,
  IframeState,
  ReadyMessage,
  SetStateMessage,
} from "./iframe-protocol-types"

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

export function isSetStateMessage(obj: any, _argumentName?: string): obj is SetStateMessage {
  return (
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.message === "set-state" &&
      ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.view_type === "exercise" &&
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
          typeof obj.data.previous_submission.exercise_id === "string" &&
          (obj.data.previous_submission.course_id === null ||
            typeof obj.data.previous_submission.course_id === "string") &&
          (obj.data.previous_submission.course_instance_id === null ||
            typeof obj.data.previous_submission.course_instance_id === "string") &&
          (obj.data.previous_submission.exam_id === null ||
            typeof obj.data.previous_submission.exam_id === "string") &&
          typeof obj.data.previous_submission.exercise_task_id === "string" &&
          (obj.data.previous_submission.grading_id === null ||
            typeof obj.data.previous_submission.grading_id === "string") &&
          typeof obj.data.previous_submission.user_id === "string"))) ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.message === "set-state" &&
      ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.view_type === "view-submission" &&
      ((obj.data !== null && typeof obj.data === "object") || typeof obj.data === "function") &&
      (obj.data.grading === null ||
        (((obj.data.grading !== null && typeof obj.data.grading === "object") ||
          typeof obj.data.grading === "function") &&
          typeof obj.data.grading.id === "string" &&
          obj.data.grading.created_at instanceof Date &&
          obj.data.grading.updated_at instanceof Date &&
          typeof obj.data.grading.submission_id === "string" &&
          (obj.data.grading.course_id === null || typeof obj.data.grading.course_id === "string") &&
          (obj.data.grading.exam_id === null || typeof obj.data.grading.exam_id === "string") &&
          typeof obj.data.grading.exercise_id === "string" &&
          typeof obj.data.grading.exercise_task_id === "string" &&
          typeof obj.data.grading.grading_priority === "number" &&
          (obj.data.grading.score_given === null ||
            typeof obj.data.grading.score_given === "number") &&
          (obj.data.grading.grading_progress === "FullyGraded" ||
            obj.data.grading.grading_progress === "Pending" ||
            obj.data.grading.grading_progress === "PendingManual" ||
            obj.data.grading.grading_progress === "Failed" ||
            obj.data.grading.grading_progress === "NotReady") &&
          (obj.data.grading.user_points_update_strategy === "CanAddPointsButCannotRemovePoints" ||
            obj.data.grading.user_points_update_strategy === "CanAddPointsAndCanRemovePoints") &&
          (obj.data.grading.unscaled_score_given === null ||
            typeof obj.data.grading.unscaled_score_given === "number") &&
          (obj.data.grading.unscaled_score_maximum === null ||
            typeof obj.data.grading.unscaled_score_maximum === "number") &&
          (obj.data.grading.grading_started_at === null ||
            obj.data.grading.grading_started_at instanceof Date) &&
          (obj.data.grading.grading_completed_at === null ||
            obj.data.grading.grading_completed_at instanceof Date) &&
          (obj.data.grading.feedback_text === null ||
            typeof obj.data.grading.feedback_text === "string") &&
          (obj.data.grading.deleted_at === null ||
            obj.data.grading.deleted_at instanceof Date)))) ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.message === "set-state" &&
      ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.view_type === "exercise-editor" &&
      ((obj.data !== null && typeof obj.data === "object") || typeof obj.data === "function"))
  )
}

export function isIframeState(obj: any, _argumentName?: string): obj is IframeState {
  return (
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.view_type === "exercise" &&
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
          typeof obj.data.previous_submission.exercise_id === "string" &&
          (obj.data.previous_submission.course_id === null ||
            typeof obj.data.previous_submission.course_id === "string") &&
          (obj.data.previous_submission.course_instance_id === null ||
            typeof obj.data.previous_submission.course_instance_id === "string") &&
          (obj.data.previous_submission.exam_id === null ||
            typeof obj.data.previous_submission.exam_id === "string") &&
          typeof obj.data.previous_submission.exercise_task_id === "string" &&
          (obj.data.previous_submission.grading_id === null ||
            typeof obj.data.previous_submission.grading_id === "string") &&
          typeof obj.data.previous_submission.user_id === "string"))) ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.view_type === "view-submission" &&
      ((obj.data !== null && typeof obj.data === "object") || typeof obj.data === "function") &&
      (obj.data.grading === null ||
        (((obj.data.grading !== null && typeof obj.data.grading === "object") ||
          typeof obj.data.grading === "function") &&
          typeof obj.data.grading.id === "string" &&
          obj.data.grading.created_at instanceof Date &&
          obj.data.grading.updated_at instanceof Date &&
          typeof obj.data.grading.submission_id === "string" &&
          (obj.data.grading.course_id === null || typeof obj.data.grading.course_id === "string") &&
          (obj.data.grading.exam_id === null || typeof obj.data.grading.exam_id === "string") &&
          typeof obj.data.grading.exercise_id === "string" &&
          typeof obj.data.grading.exercise_task_id === "string" &&
          typeof obj.data.grading.grading_priority === "number" &&
          (obj.data.grading.score_given === null ||
            typeof obj.data.grading.score_given === "number") &&
          (obj.data.grading.grading_progress === "FullyGraded" ||
            obj.data.grading.grading_progress === "Pending" ||
            obj.data.grading.grading_progress === "PendingManual" ||
            obj.data.grading.grading_progress === "Failed" ||
            obj.data.grading.grading_progress === "NotReady") &&
          (obj.data.grading.user_points_update_strategy === "CanAddPointsButCannotRemovePoints" ||
            obj.data.grading.user_points_update_strategy === "CanAddPointsAndCanRemovePoints") &&
          (obj.data.grading.unscaled_score_given === null ||
            typeof obj.data.grading.unscaled_score_given === "number") &&
          (obj.data.grading.unscaled_score_maximum === null ||
            typeof obj.data.grading.unscaled_score_maximum === "number") &&
          (obj.data.grading.grading_started_at === null ||
            obj.data.grading.grading_started_at instanceof Date) &&
          (obj.data.grading.grading_completed_at === null ||
            obj.data.grading.grading_completed_at instanceof Date) &&
          (obj.data.grading.feedback_text === null ||
            typeof obj.data.grading.feedback_text === "string") &&
          (obj.data.grading.deleted_at === null ||
            obj.data.grading.deleted_at instanceof Date)))) ||
    (((obj !== null && typeof obj === "object") || typeof obj === "function") &&
      obj.view_type === "exercise-editor" &&
      ((obj.data !== null && typeof obj.data === "object") || typeof obj.data === "function"))
  )
}
