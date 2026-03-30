"use client"

import { ALT_TEXT_NOT_CHANGED_PLACEHOLDER } from "../../services/backend/media/altTextPlaceholder"

export const shouldWarnAboutImageAltPlaceholder = (alt: unknown): boolean =>
  typeof alt === "string" && alt.trim() === ALT_TEXT_NOT_CHANGED_PLACEHOLDER
