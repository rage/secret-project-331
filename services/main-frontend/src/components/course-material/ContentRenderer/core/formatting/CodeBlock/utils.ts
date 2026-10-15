import { useCallback, useMemo } from "react"

import { useCopyToClipboard as useCopyToClipboardBase } from "@/shared-module/common/hooks/useCopyToClipboard"
import { sanitizeCourseMaterialHtml } from "@/utils/course-material/sanitizeCourseMaterialHtml"

/**
 * Returns the text a reader sees when `html` is rendered as a code block.
 *
 * A code block's content attribute is Gutenberg's HTML, not the author's literal code: the editor
 * escapes the author's own `<` and `&` (`if (a<b && c>d)` is stored as `if (a&lt;b &amp;&amp; c>d)`),
 * and adds markup of its own, such as `<br>` line breaks and a `<code>` wrapper around the value.
 * Every live tag is therefore the editor's, never the code, and dropping tags the way the rendered
 * block drops them is what makes the copied text equal the displayed text.
 *
 * Run replaceBrTagsWithNewlines first: a `<br>` holds no text, so its line break would be lost here.
 */
export function htmlToDisplayedText(html: string): string {
  const container = document.createElement("div")
  container.innerHTML = sanitizeCourseMaterialHtml(html)
  return container.textContent ?? ""
}

/**
 * Formats a set of 1-indexed line numbers into a concise string with ranges (e.g. "1, 5 to 7, 13").
 * Used for screen-reader announcement of highlighted code lines.
 */
export function formatHighlightedLinesRanges(lines: Set<number>): string {
  if (lines.size === 0) {
    return ""
  }
  const sorted = Array.from(lines).toSorted((a, b) => a - b)
  const parts: string[] = []
  const first = sorted[0]
  if (first === undefined) {
    // Unreachable: lines is non-empty (checked above), so sorted has at least one element.
    return ""
  }
  let rangeStart = first
  let rangeEnd = first
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    if (current === undefined) {
      // Unreachable: i is always a valid index into sorted.
      continue
    }
    if (current === rangeEnd + 1) {
      rangeEnd = current
    } else {
      parts.push(rangeStart === rangeEnd ? String(rangeStart) : `${rangeStart} to ${rangeEnd}`)
      rangeStart = current
      rangeEnd = current
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
  return html.replaceAll(/<br\b[^>]*>/gi, "\n")
}

/**
 * Returns a callback for copying a code block's content to clipboard.
 * `<br>` becomes a newline and the editor's remaining markup is dropped, so the clipboard gets the
 * text the reader sees rather than the HTML Gutenberg stored. Content that displays as nothing is
 * refused rather than copied, so a fully stripped block cannot clear the clipboard.
 * @param htmlContent - A code block's content attribute, as stored by Gutenberg.
 * @returns A function that when called attempts to copy the displayed text and returns true if successful.
 */
export function useCopyHtmlContentToClipboard(htmlContent: string): () => Promise<boolean> {
  const displayedText = useMemo(
    () => htmlToDisplayedText(replaceBrTagsWithNewlines(htmlContent) ?? ""),
    [htmlContent],
  )
  const copyDisplayedText = useCopyToClipboardBase(displayedText)

  return useCallback(async () => {
    if (displayedText === "") {
      return false
    }
    return await copyDisplayedText()
  }, [displayedText, copyDisplayedText])
}
