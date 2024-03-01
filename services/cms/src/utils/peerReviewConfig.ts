import { CmsPeerReviewConfig } from "../shared-module/bindings"

import { isBlockInstanceArray } from "./Gutenberg/blockInstance"

export function makeSurePeerReviewConfigAdditionalInstructionsAreNullInsteadOfEmptyLookingArray(
  config: CmsPeerReviewConfig,
): CmsPeerReviewConfig {
  if (!Array.isArray(config.additional_review_instructions)) {
    throw new Error("additional_review_instructions is not an array")
  }
  if (!config.additional_review_instructions) {
    return config
  }
  if (!isBlockInstanceArray(config.additional_review_instructions)) {
    throw new Error("additional_review_instructions is not block instance array")
  }
  const containsOnlyEmptyParagraphs = config.additional_review_instructions.every((block) => {
    return block.name === "core/paragraph" && block.attributes.content.trim() === ""
  })
  if (config.additional_review_instructions.length === 0 || containsOnlyEmptyParagraphs) {
    return { ...config, additional_review_instructions: null }
  }
  return config
}
