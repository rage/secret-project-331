import { TFunction } from "i18next"

import { OpenDialogOptions } from "@/shared-module/exercise-client/client/parentDialog"

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
 * Tokens longer than this are never citations: real URLs/DOIs fit well under it, and it keeps a
 * huge unbroken block (e.g. CJK text or code) counted as content.
 */
const MAX_CITATION_TOKEN_LENGTH = 512

/**
 * Whole-token matchers for citation-like content excluded from the paste size: URLs, DOIs, emails,
 * bare domains with a path, and numbered markers like [1]. Kept anchored and unambiguous so they
 * run in linear time.
 */
const CITATION_TOKEN_PATTERNS: RegExp[] = [
  /^[([]?(?:https?:\/\/|www\.)\S+$/i,
  /^[([]?(?:doi:)?10\.\d{4,9}\/\S+$/i,
  /^[^\s@]+@[^\s@]+\.[a-z]{2,}[.,;:)]?$/i,
  /^(?:[\w-]+\.)+[a-z]{2,}\/\S*$/i,
  /^\[\d{1,3}\][.,;:)]?$/,
]

const isCitationToken = (token: string): boolean =>
  token.length <= MAX_CITATION_TOKEN_LENGTH &&
  CITATION_TOKEN_PATTERNS.some((pattern) => pattern.test(token))

/**
 * Whether a pasted chunk of text is large enough to warrant the academic-integrity warning.
 * Discard citation-like tokens (links, DOIs, emails, citation markers), so that pasting citations
 * doesn't trigger the warning.
 */
export function isLargePaste(pastedText: string): boolean {
  if (!pastedText) {
    return false
  }
  const proseTokens = pastedText.split(/\s+/).filter((token) => token && !isCitationToken(token))
  return (
    proseTokens.length >= LARGE_PASTE_WORD_THRESHOLD ||
    proseTokens.join(" ").length >= LARGE_PASTE_CHAR_THRESHOLD
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
