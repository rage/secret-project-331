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
  console.info("[Copy] Success using legacy method", "\nCopied text:", text)
}

/**
 * Attempts to copy text using the Clipboard API.
 * @throws Error if copy fails
 */
async function copyWithClipboardApi(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
  console.info("[Copy] Success using Clipboard API", "\nCopied text:", text)
}

/**
 * Returns a callback for copying code to clipboard.
 * @returns A function that when called attempts to copy text and returns true if successful
 */
export function useCopyToClipboard(content: string): () => Promise<boolean> {
  const copyToClipboard = useCallback(async (): Promise<boolean> => {
    const copyOfContent = copyString(content)
    const withoutNewLines = replaceBrTagsWithNewlines(copyOfContent) ?? ""
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
              "[Copy] Unable to use Clipboard API (HTTPS required)",
              "To enable the best copy experience, please access this page via HTTPS.",
              "\nTrying legacy method.",
            )
          } else if (isPermissionError) {
            console.warn(
              "[Copy] Unable to use Clipboard API (Permission denied)",
              "\nError details:",
              error instanceof Error ? error.message : String(error),
              "\nTrying legacy method.",
            )
          } else {
            console.warn(
              "[Copy] Unable to use Clipboard API (Unknown error)",
              "\nError details:",
              error instanceof Error ? error.message : String(error),
              "\nTrying legacy method.",
            )
          }
          copyWithFallback(textToCopy)
          return true
        }
      } else {
        console.warn("[Copy] Clipboard API not available", "\nTrying legacy method.")
        copyWithFallback(textToCopy)
        return true
      }
    } catch (error) {
      console.error(
        "[Copy Failed] Copy operation failed",
        "Please try selecting the text manually and using Ctrl+C/Cmd+C.",
        error,
      )
      return false
    }
  }, [content])

  return copyToClipboard
}
