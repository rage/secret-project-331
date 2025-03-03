import { useCallback } from "react"

import { copyString } from "@/shared-module/common/utils/strings"

/**
 * Decodes HTML entities in a string
 */
export function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement("textarea")
  textarea.innerHTML = text
  return textarea.value
}

/**
 * Replaces HTML BR tags with newline characters and decodes HTML entities.
 * Used specifically for code block content formatting.
 */
export function replaceBrTagsWithNewlines(html: string | null | undefined): typeof html {
  if (!html) {
    return html
  }
  return html.replace(/<br\b[^>]*>/gi, "\n")
}

/**
 * Fallback copy method using execCommand.
 */
function copyWithFallback(text: string) {
  const textArea = document.createElement("textarea")
  textArea.value = text
  document.body.appendChild(textArea)
  textArea.select()

  const successful = document.execCommand("copy")
  document.body.removeChild(textArea)
  if (!successful) {
    throw new Error("Copy failed")
  }
}

/**
 * Returns a callback for copying code to clipboard. The code can contain:
 * - HTML entities (like &lt; &gt; &amp;) -> Will be decoded to actual characters
 * - Actual HTML <br> tags -> Will be replaced with newlines
 * - Literal backslash-n sequences (like \n) -> Will be preserved
 * - Actual newlines -> Will be preserved
 *
 * The processing order matters:
 * 1. Copy content to avoid mutating original
 * 2. Replace actual <br> tags with newlines
 * 3. Decode HTML entities (&lt; -> <, &gt; -> >, &amp; -> &)
 *
 */
export function useCopyToClipboard(content: string) {
  const copyToClipboard = useCallback(async () => {
    const copyOfContent = copyString(content)
    const withoutNewLines = replaceBrTagsWithNewlines(copyOfContent) ?? ""
    const textToCopy = decodeHtmlEntities(withoutNewLines)

    try {
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(textToCopy)
          return { success: true }
        } catch {
          copyWithFallback(textToCopy)
          return { success: true }
        }
      } else {
        copyWithFallback(textToCopy)
        return { success: true }
      }
    } catch (error) {
      console.error("Copying to clipboard failed:", error)
      return { success: false }
    }
  }, [content])

  return copyToClipboard
}
