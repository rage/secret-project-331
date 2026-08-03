import type React from "react"

/**
 * The slice of the host app's dialog system this package needs to answer an iframe's requests —
 * `open-dialog`, and the confirmations for `open-link` / `download-file`. The host injects it
 * (typically from common's `useDialog()`), which keeps this package free of a `common` dependency
 * while still supporting parent-rendered dialogs.
 */
export interface ExerciseDialogApi {
  alert: (
    message: React.ReactNode,
    title?: string,
    options?: { okButtonLabel?: string },
  ) => Promise<void>
  confirm: (
    message: React.ReactNode,
    title?: string,
    options?: { yesButtonLabel?: string; noButtonLabel?: string },
  ) => Promise<boolean>
}
