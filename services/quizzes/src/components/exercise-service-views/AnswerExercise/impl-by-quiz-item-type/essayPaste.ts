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
 * Numbered citation markers like [1]. Removed from the text before measuring so that markers
 * glued to words or to each other ("word.[1][2]") don't count toward either threshold.
 */
const CITATION_MARKERS = /\[\d{1,3}\]/g

/**
 * Whole-token matchers for citation-like content excluded from the paste size: URLs (plain or
 * markdown-wrapped), DOIs, emails, bare domains with a path, and punctuation-only leftovers.
 * Kept anchored and unambiguous so they run in linear time. Leading wrappers like `("<` are
 * allowed in-pattern; trailing punctuation is peeled off by isCitationToken.
 */
const CITATION_TOKEN_PATTERNS: RegExp[] = [
  /^[<(["']*(?:https?:\/\/|www\.)\S+$/i,
  /^[<(["']*(?:doi:)?10\.\d{4,9}\/\S+$/i,
  /^[<(["']*doi:$/i,
  /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i,
  /^[<(["']*(?:[\w-]+\.)+[a-z]{2,}\/\S*$/i,
  /^\[[^\]]*\]\(\S+\)$/,
  /^[^\p{L}\p{N}]+$/u,
]

const TRAILING_AFFIX = /[>)\]"'.,;:]$/

/** Bounds the trailing-punctuation peeling so retesting stays constant per token. */
const MAX_AFFIX_PEEL = 4

const isCitationToken = (token: string): boolean => {
  if (token.length > MAX_CITATION_TOKEN_LENGTH) {
    return false
  }
  for (let end = token.length; end > 0 && end >= token.length - MAX_AFFIX_PEEL; end--) {
    const core = token.slice(0, end)
    if (CITATION_TOKEN_PATTERNS.some((pattern) => pattern.test(core))) {
      return true
    }
    if (!TRAILING_AFFIX.test(core)) {
      return false
    }
  }
  return false
}

/**
 * Whether a pasted chunk of text is large enough to warrant the academic-integrity warning.
 * Citation-like content (links, DOIs, emails, citation markers) is excluded from the measurement,
 * so that pasting citations doesn't trigger the warning. The character count includes whitespace
 * between prose tokens so that indented code and line-broken blocks are measured at full size.
 * Scans incrementally and returns as soon as a threshold is reached, keeping huge pastes cheap.
 */
export function isLargePaste(pastedText: string): boolean {
  if (!pastedText) {
    return false
  }
  const text = pastedText.replace(CITATION_MARKERS, "")
  const tokens = /\S+/g
  let proseWords = 0
  let proseChars = 0
  let pendingWhitespace = 0
  let previousEnd = 0
  for (let match = tokens.exec(text); match !== null; match = tokens.exec(text)) {
    pendingWhitespace += match.index - previousEnd
    previousEnd = tokens.lastIndex
    if (isCitationToken(match[0])) {
      continue
    }
    if (proseChars > 0) {
      proseChars += pendingWhitespace
    }
    pendingWhitespace = 0
    proseWords += 1
    proseChars += match[0].length
    if (proseWords >= LARGE_PASTE_WORD_THRESHOLD || proseChars >= LARGE_PASTE_CHAR_THRESHOLD) {
      return true
    }
  }
  return false
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
