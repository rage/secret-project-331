import type React from "react"

/** Content of an `alert` or `confirm` this package shows on the iframe's behalf. */
export interface ExerciseDialogRequest {
  title?: string
  message: React.ReactNode
}

export type ExerciseAlertRequest = ExerciseDialogRequest & {
  /** Label of the single acknowledge action, in the host's own wording. */
  acknowledgeLabel?: string
}

export type ExerciseConfirmRequest = ExerciseDialogRequest & {
  /** Label of the affirmative action, in the host's own wording. */
  confirmLabel?: string
  /** Label of the negative action, in the host's own wording. */
  cancelLabel?: string
}

/**
 * The slice of the host app's dialog system this package needs to answer an iframe's requests —
 * `open-dialog`, and the confirmations for `open-link` / `download-file`. The host injects it
 * (typically the `useDialog()` from shared-module's `components` package); this type is
 * structural rather than imported so this package stays free of a `components` dependency, which
 * matters because it is also published standalone (see tsdown.config.ts) to be embedded by
 * exercise-service hosts outside this monorepo.
 */
export interface ExerciseDialogApi {
  alert: (request: ExerciseAlertRequest | string) => Promise<void>
  confirm: (request: ExerciseConfirmRequest | string) => Promise<boolean>
}
