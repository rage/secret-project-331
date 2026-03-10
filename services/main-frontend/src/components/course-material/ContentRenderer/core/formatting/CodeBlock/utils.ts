import { useCopyToClipboard as useCopyToClipboardBase } from "@/shared-module/common/hooks/useCopyToClipboard"

/**
 * Decodes HTML entities in a string
 */
export function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement("textarea")
  textarea.innerHTML = text
  return textarea.value
}

/**
 * Formats a set of 1-indexed line numbers into a concise string with ranges (e.g. "1, 5 to 7, 13").
 * Used for screen-reader announcement of highlighted code lines.
 */
export function formatHighlightedLinesRanges(lines: Set<number>): string {
  if (lines.size === 0) {
    return ""
  }
  const sorted = Array.from(lines).sort((a, b) => a - b)
  const parts: string[] = []
  let rangeStart = sorted[0]
  let rangeEnd = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === rangeEnd + 1) {
      rangeEnd = sorted[i]
    } else {
      parts.push(rangeStart === rangeEnd ? String(rangeStart) : `${rangeStart} to ${rangeEnd}`)
      rangeStart = sorted[i]
      rangeEnd = sorted[i]
    }
  }
  parts.push(rangeStart === rangeEnd ? String(rangeStart) : `${rangeStart} to ${rangeEnd}`)
  return parts.join(", ")
}

/**
 * Replaces HTML BR tags (e.g. from Gutenberg) with newline characters.
 * Only actual `<br>`, `<br/>`, `<br />` etc. are matched; escaped br such as `&lt;br&gt;` is not
 * replaced and will render as literal "<br>" text (so users can show br in code).
 */
export function replaceBrTagsWithNewlines(html: string | null | undefined): typeof html {
  if (!html) {
    return html
  }
  return html.replace(/<br\b[^>]*>/gi, "\n")
}

/**
 * Returns a callback for copying HTML content to clipboard.
 * Processes HTML content by replacing BR tags with newlines and decoding HTML entities before copying.
 * @param htmlContent - The HTML content to copy (will be processed before copying)
 * @returns A function that when called attempts to copy the processed text and returns true if successful
 */
export function useCopyHtmlContentToClipboard(htmlContent: string): () => Promise<boolean> {
  const withoutNewLines = replaceBrTagsWithNewlines(htmlContent) ?? ""
  const processedText = decodeHtmlEntities(withoutNewLines)
  const baseCopyToClipboard = useCopyToClipboardBase(processedText)

  return baseCopyToClipboard
}
