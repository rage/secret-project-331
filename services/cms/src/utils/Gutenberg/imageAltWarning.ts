"use client"

import type { BlockInstance } from "@/utils/Gutenberg/types"

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

/**
 * Image blocks, nested ones included and in document order, that are not decorative and whose alt
 * is missing, blank or still the upload placeholder. Stricter than
 * `shouldWarnAboutImageAltPlaceholder`, which ignores an absent alt.
 */
export const findImagesNeedingAltText = (blocks: BlockInstance[]): BlockInstance[] =>
  blocks.flatMap((block) => {
    const ownMatch =
      block.name === "core/image" &&
      shouldWarnAboutImageAltPlaceholder(
        block.attributes?.alt ?? "",
        block.attributes?.isDecorative,
      )
        ? [block]
        : []
    return [...ownMatch, ...findImagesNeedingAltText(block.innerBlocks ?? [])]
  })
