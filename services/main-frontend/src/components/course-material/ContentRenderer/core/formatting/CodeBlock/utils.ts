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
