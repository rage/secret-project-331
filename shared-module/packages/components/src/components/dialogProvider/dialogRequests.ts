import type React from "react"

import type { DialogSize } from "../Dialog"

/** Fields every dialog request shares. */
interface DialogRequest {
  /**
   * Heading, and the dialog's accessible name. Omit for a message-only dialog; a string `message`
   * then names it. Sentence case, no trailing punctuation.
   */
  title?: string
  /**
   * The question or statement. For `alert`/`confirm`, a string is announced the moment the dialog
   * opens, because it selects `role="alertdialog"`; a node body, or any `prompt`, is rendered as
   * the body and is not announced (a prompt always uses `role="dialog"`, even with a string
   * message, since its field needs focus rather than an interruption to read).
   */
  message: React.ReactNode
  /** The consequence, rendered and announced under `message`. Use instead of joining sentences. */
  description?: string
  size?: DialogSize
  /** `lang` on the dialog root, when the content is not in the UI language. */
  lang?: string
}

export type AlertRequest = DialogRequest & {
  /** Label of the single acknowledge action. Default: `dialog.ok`. */
  acknowledgeLabel?: string
}

export type ConfirmRequest = DialogRequest & {
  /**
   * Affirmative action's label. Default: `dialog.confirm` ("Yes"). Pass a verb whenever
   * `isDestructive` is set: "Yes" is the last thing a screen reader user hears before the row goes.
   */
  confirmLabel?: string
  /** Negative action's label. Default: `dialog.decline` ("No"). */
  cancelLabel?: string
  /**
   * The affirmative action deletes data or cannot be undone. Renders it as `variant="danger"` and
   * deliberately leaves initial focus on the dialog itself, so nothing destructive is armed.
   */
  isDestructive?: boolean
}

interface PromptLabels {
  /** Label of the action that resolves with the value. Default: `dialog.ok`. */
  submitLabel?: string
  /** Label of the action that resolves as dismissed. Default: `dialog.cancel`. */
  cancelLabel?: string
}

export type TextPromptRequest = DialogRequest &
  PromptLabels & {
    /** Initial contents of the built-in text field, which also arms the submit action. */
    defaultValue?: string
    /** Run on submit. Return a message to block submission and show it on the field. */
    validate?: (value: string) => string | undefined
  }

export type CustomPromptRequest<T> = DialogRequest &
  PromptLabels & {
    /**
     * Replaces the built-in text field. Rendered inside the dialog body, and given the controls
     * that produce the dialog's result.
     */
    body: (controls: PromptControls<T>) => React.ReactNode
  }

export interface PromptControls<T> {
  /**
   * Set the value the dialog will resolve with. The submit action stays disabled until this has
   * been called at least once, or `defaultValue` supplied a value.
   */
  setValue: (value: T) => void
  /** Resolve now with this value, as if submit were pressed. */
  submit: (value: T) => void
  /** Resolve now as dismissed. */
  dismiss: () => void
}

/**
 * What a `prompt` resolves with. `value` exists only on the submitted branch, so an unnarrowed
 * `result.value` is a type error and a cancelled prompt cannot be mistaken for an empty one.
 */
export type PromptResult<T> = { isSubmitted: true; value: T } | { isSubmitted: false }

/**
 * Promise-based replacement for `window.alert` / `confirm` / `prompt`.
 *
 * A bare string is shorthand for `{ message }`. Every request is queued: at most one dialog is
 * visible at a time, in call order, except that a request made from inside an open dialog's body
 * stacks on top of it immediately.
 */
export interface DialogApi {
  alert: (request: AlertRequest | string) => Promise<void>
  confirm: (request: ConfirmRequest | string) => Promise<boolean>
  prompt: {
    (request: TextPromptRequest): Promise<PromptResult<string>>
    <T>(request: CustomPromptRequest<T>): Promise<PromptResult<T>>
  }
}

export type DialogKind = "alert" | "confirm" | "prompt"

export type AnyDialogRequest =
  | AlertRequest
  | ConfirmRequest
  | TextPromptRequest
  | CustomPromptRequest<unknown>

/** One queued or open dialog. `resolve` is called at most once, guarded by the provider. */
export interface DialogEntry {
  id: number
  kind: DialogKind
  /** How many dialog bodies this request was made from inside of; 0 outside any dialog. */
  depth: number
  request: AnyDialogRequest
  resolve: (result: unknown) => void
}

/** What each kind resolves with when the user backs out, or the provider unmounts mid-flow. */
export function dismissedResult(kind: DialogKind): unknown {
  switch (kind) {
    case "alert":
      return undefined
    case "confirm":
      return false
    case "prompt":
      return { isSubmitted: false }
  }
}

export function normalizeRequest(request: AnyDialogRequest | string): AnyDialogRequest {
  return typeof request === "string" ? { message: request } : request
}
