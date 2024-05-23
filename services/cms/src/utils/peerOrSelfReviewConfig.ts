import { isBlockInstanceArray } from "./Gutenberg/blockInstance"

import { CmsPeerOrSelfReviewConfig } from "@/shared-module/common/bindings"

export function makeSurePeerOrSelfReviewConfigAdditionalInstructionsAreNullInsteadOfEmptyLookingArray(
  config: CmsPeerOrSelfReviewConfig,
): CmsPeerOrSelfReviewConfig {
  if (!Array.isArray(config.review_instructions)) {
    throw new Error("review_instructions is not an array")
  }
  if (!config.review_instructions) {
    return config
  }
  if (!isBlockInstanceArray(config.review_instructions)) {
    throw new Error("review_instructions is not block instance array")
  }
  const containsOnlyEmptyParagraphs = config.review_instructions.every((block) => {
    return block.name === "core/paragraph" && block.attributes.content.trim() === ""
  })
  if (config.review_instructions.length === 0 || containsOnlyEmptyParagraphs) {
    return { ...config, review_instructions: null }
  }
  return config
}
