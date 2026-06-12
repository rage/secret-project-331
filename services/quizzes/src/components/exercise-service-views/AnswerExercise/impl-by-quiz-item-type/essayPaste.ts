import { TFunction } from "i18next"

import { OpenDialogOptions } from "@/shared-module/common/exercise-service-protocol/parentDialog"
import { wordCount } from "@/shared-module/common/utils/strings"

/**
 * A single paste of at least this many words is treated as "large" and triggers the
 * academic-integrity warning. Tuned to ignore ordinary edits (a sentence or a fixed-up phrase)
 * while catching the wholesale pasting of an answer.
 */
export const LARGE_PASTE_WORD_THRESHOLD = 50

/**
 * Character fallback for content that the whitespace-based word count under-counts, e.g. a long
 * unbroken block, code, or scripts that do not separate words with spaces (CJK and similar).
 */
export const LARGE_PASTE_CHAR_THRESHOLD = 400

/**
 * Whether a pasted chunk of text is large enough to warrant the academic-integrity warning. Pure so
 * it can be unit tested independently of the essay component.
 */
export function isLargePaste(pastedText: string): boolean {
  if (!pastedText) {
    return false
  }
  return (
    wordCount(pastedText) >= LARGE_PASTE_WORD_THRESHOLD ||
    pastedText.trim().length >= LARGE_PASTE_CHAR_THRESHOLD
  )
}

/**
 * Returns the dialog the parent should show to warn about a large essay paste, or `null` when the
 * paste is small enough to ignore. Kept separate from the component (and pure aside from `t`) so the
 * decision and the warning content can be unit tested without rendering React.
 *
 * Note: this is intentionally a warning, not a block — pasting your own draft is legitimate, so the
 * caller must not discard the pasted text.
 */
export function getEssayPasteWarning(pastedText: string, t: TFunction): OpenDialogOptions | null {
  if (!isLargePaste(pastedText)) {
    return null
  }
  return {
    dialogType: "warning",
    title: t("essay-paste-warning-title"),
    body: t("essay-paste-warning-body").split("\n\n"),
    confirmButtonLabel: t("essay-paste-warning-acknowledge"),
  }
}
