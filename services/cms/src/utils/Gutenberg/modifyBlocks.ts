/* eslint-disable i18next/no-literal-string */
import { BlockInstance } from "@wordpress/blocks"

const UNCOMMON_SPACES_REGEX = /[\u00A0\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g

export const modifyBlocks = (
  blocks: BlockInstance[],
  supportedBlocks: string[],
): BlockInstance[] => {
  const modifiedBlocks = blocks.map((block) => {
    if (supportedBlocks.find((supportedBlock) => supportedBlock === block.name) === undefined) {
      return {
        clientId: block.clientId,
        name: "moocfi/unsupported-block-type",
        isValid: true,
        attributes: { ...block.attributes, originalBlockJson: block },
        innerBlocks: [],
      }
    } else {
      return block
    }
  })
  return modifiedBlocks
}

/**
 * Internal helper function used by removeUncommonSpacesFromBlocks.
 * Replaces various Unicode space characters (like non-breaking spaces,
 * mathematical spaces, etc.) with standard spaces.
 *
 * @param text - The text to process
 * @returns Text with standardized spaces
 */
const replaceUncommonSpaces = (text: string): string => {
  return text.replace(UNCOMMON_SPACES_REGEX, " ")
}

/**
 * Recursively removes uncommon space characters from paragraph blocks and returns a new array with the changes.
 * This function creates deep copies and does not modify the original blocks.
 *
 * Handles the following Unicode space characters:
 * - U+00A0 (Non-breaking space)
 * - U+2000 to U+200A (Various width spaces)
 * - U+2028 (Line separator)
 * - U+2029 (Paragraph separator)
 * - U+202F (Narrow non-breaking space)
 * - U+205F (Medium mathematical space)
 * - U+3000 (Ideographic space)
 *
 * @param blocks - Array of Gutenberg block instances to process
 * @returns A new array of blocks with uncommon spaces replaced
 */
export const removeUncommonSpacesFromBlocks = (blocks: BlockInstance[]): BlockInstance[] => {
  return blocks.map((block) => {
    const newBlock = { ...block }
    const attributes = { ...block.attributes }

    // Handle different block types
    switch (block.name) {
      case "core/paragraph":
      case "core/heading":
        if (attributes.content) {
          attributes.content = replaceUncommonSpaces(attributes.content)
        }
        break

      case "moocfi/hero-section":
        if (attributes.title) {
          attributes.title = replaceUncommonSpaces(attributes.title)
        }
        if (attributes.subtitle) {
          attributes.subtitle = replaceUncommonSpaces(attributes.subtitle)
        }
        break
    }

    newBlock.attributes = attributes

    if (block.innerBlocks && block.innerBlocks.length > 0) {
      newBlock.innerBlocks = removeUncommonSpacesFromBlocks(block.innerBlocks)
    }

    return newBlock
  })
}
