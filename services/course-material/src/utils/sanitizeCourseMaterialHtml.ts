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
 * Enforces protocol allowlist and safely handles relative URLs to prevent CSS injection
 */
export const escapeUrlForCss = (url: string | undefined): string => {
  if (!url?.trim()) {
    return ""
  }

  const trimmedUrl = url.trim()

  try {
    // Block dangerous schemes (colon before any slash = likely a scheme)
    const colonIndex = trimmedUrl.indexOf(":")
    const slashIndex = trimmedUrl.indexOf("/")
    if (colonIndex !== -1 && (slashIndex === -1 || colonIndex < slashIndex)) {
      const scheme = trimmedUrl.substring(0, colonIndex + 1).toLowerCase()
      // Only allow safe schemes
      if (!["http:", "https:"].includes(scheme)) {
        console.error(`Blocked dangerous URL scheme in CSS: ${scheme} from URL: ${trimmedUrl}`)
        return ""
      }
    }

    // Handle protocol-relative URLs (//example.com)
    if (trimmedUrl.startsWith("//")) {
      // Validate the URL structure by parsing with https, but return as protocol-relative
      new URL("https:" + trimmedUrl) // This will throw if invalid
      console.warn(`Using protocol-relative URL in CSS: ${trimmedUrl}`)
      return trimmedUrl
    }

    // Handle absolute URLs
    if (trimmedUrl.includes("://")) {
      const parsed = new URL(trimmedUrl)
      if (!["http:", "https:"].includes(parsed.protocol)) {
        console.error(
          `Blocked disallowed protocol in CSS URL: ${parsed.protocol} from URL: ${trimmedUrl}`,
        )
        return ""
      }
      return parsed.toString()
    }

    // Handle relative URLs - resolve with current origin if available
    if (trimmedUrl.startsWith("/") || trimmedUrl.startsWith("./") || trimmedUrl.startsWith("../")) {
      const base = typeof window !== "undefined" ? window.location?.origin : undefined
      if (base) {
        const resolved = new URL(trimmedUrl, base).toString()
        console.warn(`Resolved relative URL in CSS: ${trimmedUrl} -> ${resolved}`)
        return resolved
      } else {
        console.warn(`Using relative URL in server context: ${trimmedUrl}`)
        return encodeURI(trimmedUrl)
          .replace(/'/g, "%27")
          .replace(/"/g, "%22")
          .replace(/\\/g, "%5C")
          .replace(/\(/g, "%28")
          .replace(/\)/g, "%29")
      }
    }

    console.warn(`Rejecting unrecognized URL pattern in CSS: ${trimmedUrl}`)
    return ""
  } catch (error) {
    console.error(`Failed to parse URL for CSS: ${trimmedUrl}`, error)
    return ""
  }
}
