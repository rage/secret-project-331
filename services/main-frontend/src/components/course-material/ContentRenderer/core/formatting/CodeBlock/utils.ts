import { useCallback } from "react"

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
 * @throws Error if copy fails
 */
function copyWithFallback(text: string): void {
  const textArea = document.createElement("textarea")
  textArea.value = text
  document.body.appendChild(textArea)
  textArea.select()

  const successful = document.execCommand("copy")
  document.body.removeChild(textArea)
  if (!successful) {
    throw new Error("Copy failed")
  }
  console.info(`[Copy] Success using legacy method:\n${text}`)
}

/**
 * Attempts to copy text using the Clipboard API.
 * @throws Error if copy fails
 */
async function copyWithClipboardApi(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
  console.info(`[Copy] Success using Clipboard API:\n${text}`)
}

/**
 * Returns a callback for copying code to clipboard.
 * @returns A function that when called attempts to copy text and returns true if successful
 */
export function useCopyToClipboard(content: string): () => Promise<boolean> {
  const copyToClipboard = useCallback(async (): Promise<boolean> => {
    const withoutNewLines = replaceBrTagsWithNewlines(content) ?? ""
    const textToCopy = decodeHtmlEntities(withoutNewLines)

    try {
      if (navigator.clipboard) {
        try {
          await copyWithClipboardApi(textToCopy)
          return true
        } catch (error) {
          const isSecureContext = window.isSecureContext
          const isPermissionError = error instanceof Error && error.name === "NotAllowedError"

          if (!isSecureContext) {
            console.warn(
              "[Copy] Unable to use Clipboard API - HTTPS required. Trying legacy method.",
            )
          } else if (isPermissionError) {
            console.warn(
              `[Copy] Unable to use Clipboard API - Permission denied: ${error instanceof Error ? error.message : String(error)}. Trying legacy method.`,
            )
          } else {
            console.warn(
              `[Copy] Unable to use Clipboard API - Unknown error: ${error instanceof Error ? error.message : String(error)}. Trying legacy method.`,
            )
          }
          copyWithFallback(textToCopy)
          return true
        }
      } else {
        console.warn("[Copy] Clipboard API not available. Trying legacy method.")
        copyWithFallback(textToCopy)
        return true
      }
    } catch (error) {
      console.error(
        `[Copy Failed] Copy operation failed. Please try selecting the text manually and using Ctrl+C/Cmd+C. Error: ${error}`,
      )
      return false
    }
  }, [content])

  return copyToClipboard
}
