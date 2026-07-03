"use client"

import { ALT_TEXT_NOT_CHANGED_PLACEHOLDER } from "../../services/altTextPlaceholder"

// Warn when a non-decorative image's alt is still the placeholder or has been left blank.
// Decorative images are intentionally alt-less, so never warn about them.
export const shouldWarnAboutImageAltPlaceholder = (
  alt: unknown,
  isDecorative: unknown = false,
): boolean => {
  if (isDecorative === true || typeof alt !== "string") {
    return false
  }
  const trimmed = alt.trim()
  return trimmed === ALT_TEXT_NOT_CHANGED_PLACEHOLDER || trimmed === ""
}
