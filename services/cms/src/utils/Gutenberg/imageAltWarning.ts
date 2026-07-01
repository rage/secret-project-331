"use client"

import { ALT_TEXT_NOT_CHANGED_PLACEHOLDER } from "../../services/altTextPlaceholder"

// Decorative images are intentionally alt-less, so never warn about their placeholder alt.
export const shouldWarnAboutImageAltPlaceholder = (
  alt: unknown,
  isDecorative: unknown = false,
): boolean =>
  isDecorative !== true &&
  typeof alt === "string" &&
  alt.trim() === ALT_TEXT_NOT_CHANGED_PLACEHOLDER
