import type { BlockInstance } from "@/utils/Gutenberg/types"

const UNCOMMON_SPACES_REGEX = /[\u00A0\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/
const UNCOMMON_SPACES_GLOBAL_REGEX = new RegExp(UNCOMMON_SPACES_REGEX.source, "g")

export const modifyBlocks = (
  blocks: BlockInstance[],
  supportedBlocks: string[],
): BlockInstance[] => {
  return blocks.map((block) => {
    const innerBlocks = block.innerBlocks ?? []

    if (!supportedBlocks.some((supportedBlock) => supportedBlock === block.name)) {
      return {
        clientId: block.clientId,
        name: "moocfi/unsupported-block-type",
        isValid: true,
        attributes: { ...block.attributes, originalBlockJson: block },
        innerBlocks: [],
      }
    }

    if (innerBlocks.length === 0) {
      return block
    }

    return {
      ...block,
      innerBlocks: modifyBlocks(innerBlocks, supportedBlocks),
    }
  })
}

/** The fields where the page save turns non-breaking and other uncommon spaces into plain ones. */
export const UNCOMMON_SPACE_FIELDS: ReadonlyMap<string, readonly string[]> = new Map([
  ["core/paragraph", ["content"]],
  ["core/heading", ["content"]],
  ["moocfi/hero-section", ["title", "subtitle"]],
])

/** Whether text has a space the page save would replace; see `UNCOMMON_SPACE_FIELDS`. */
export const hasUncommonSpaces = (text: string): boolean => UNCOMMON_SPACES_REGEX.test(text)

/**
 * Replaces U+00A0, U+2000–U+200A, U+2028, U+2029, U+202F, U+205F and U+3000 with plain spaces in
 * `UNCOMMON_SPACE_FIELDS`, recursively. Returns new blocks and leaves the input unchanged.
 */
export const removeUncommonSpacesFromBlocks = (blocks: BlockInstance[]): BlockInstance[] => {
  return blocks.map((block) => {
    const newBlock = { ...block }
    const attributes = { ...block.attributes }
    for (const field of UNCOMMON_SPACE_FIELDS.get(block.name) ?? []) {
      const value = attributes[field]
      if (typeof value === "string" && value !== "") {
        attributes[field] = value.replaceAll(UNCOMMON_SPACES_GLOBAL_REGEX, " ")
      }
    }
    newBlock.attributes = attributes

    if (block.innerBlocks && block.innerBlocks.length > 0) {
      newBlock.innerBlocks = removeUncommonSpacesFromBlocks(block.innerBlocks)
    }

    return newBlock
  })
}
