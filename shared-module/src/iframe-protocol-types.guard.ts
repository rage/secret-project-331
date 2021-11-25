/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

/*
 * Generated type guards for "iframe-protocol-types.ts".
 * WARNING: Do not manually change this file.
 */
import {
  CurrentStateMessage,
  HeightChangedMessage,
  ReadyMessage,
  SetStateMessage,
  ViewType,
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

export function isViewType(obj: any, _argumentName?: string): obj is ViewType {
  return (
    obj === "exercise" ||
    obj === "view-submission" ||
    obj === "exercise-editor" ||
    obj === "playground-exercise"
  )
}

export function isSetStateMessage(obj: any, _argumentName?: string): obj is SetStateMessage {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    obj.message === "set-state" &&
    (isViewType(obj.view_type) as boolean)
  )
}
