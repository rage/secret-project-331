export interface ParagraphAiSource {
  originalHtml: string
  originalText: string
  requestContent: string
  requestIsHtml: boolean
}

const HTML_TAG_PATTERN = /<\/?[a-z][^>]*>/i

/** Extracts readable text from a paragraph HTML fragment. */
export const extractPlainTextFromHtml = (html: string): string => {
  if (!html) {
    return ""
  }

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const element = document.createElement("div")
    element.innerHTML = html
    return element.textContent || element.innerText || ""
  }

  return html.replace(/<[^>]+>/g, "")
}

/**
 * Returns whether a suggestion changes the saved paragraph HTML, including
 * markup-only edits that leave the visible text unchanged.
 */
export const hasMeaningfulParagraphSuggestionChange = (
  originalHtml: string,
  suggestion: string,
): boolean => {
  const normalizedOriginalHtml = typeof originalHtml === "string" ? originalHtml.trim() : ""
  const normalizedSuggestion = typeof suggestion === "string" ? suggestion.trim() : ""

  return normalizedSuggestion.length > 0 && normalizedSuggestion !== normalizedOriginalHtml
}

/** Returns the content sent to the AI request and the plain-text preview text. */
export const createParagraphAiSource = (html: string): ParagraphAiSource => {
  const originalHtml = typeof html === "string" ? html : ""

  return {
    originalHtml,
    originalText: extractPlainTextFromHtml(originalHtml),
    requestContent: originalHtml,
    requestIsHtml: HTML_TAG_PATTERN.test(originalHtml),
  }
}
