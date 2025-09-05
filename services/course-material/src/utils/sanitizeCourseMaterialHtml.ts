import DOMPurify from "dompurify"

import { StringWithHTML } from "../../types"

export const sanitizeCourseMaterialHtml = (
  dirty: string | undefined | StringWithHTML,
  config?: DOMPurify.Config,
): string => {
  if (dirty === undefined) {
    return ""
  }
  const newConfig: DOMPurify.Config = {
    ...config,
    RETURN_TRUSTED_TYPE: true,
  }
  return DOMPurify.sanitize(dirty, newConfig).toString()
}

/**
 * Validates and safely formats a URL for use in CSS background-image property
 * Uses URL parsing for proper validation and encoding
 */
export const escapeUrlForCss = (url: string | undefined): string => {
  if (!url) {
    return ""
  }

  try {
    // Parse the URL to validate it and get properly encoded components
    const parsedUrl = new URL(url)

    // Reconstruct the URL with proper encoding
    // This automatically handles all special characters correctly
    return parsedUrl.toString()
  } catch (error) {
    // If URL parsing fails, fall back to basic validation and encoding
    console.error(`Invalid URL provided to escapeUrlForCss: ${url}`, error)

    // For relative URLs or other cases where URL constructor fails,
    // use encodeURI for basic safety
    try {
      return encodeURI(url)
    } catch {
      // If even encodeURI fails, return empty string to prevent CSS injection
      return ""
    }
  }
}
