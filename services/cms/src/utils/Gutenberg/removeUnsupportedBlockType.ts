import type { BlockInstance } from "@/utils/Gutenberg/types"

export function removeUnsupportedBlockType(blocks: BlockInstance[]): BlockInstance[] {
  return blocks.map((block) => {
    const innerBlocks = block.innerBlocks ?? []

    if (block.name === "moocfi/unsupported-block-type") {
      return block.attributes.originalBlockJson
    }

    if (innerBlocks.length === 0) {
      return block
    }

    return {
      ...block,
      innerBlocks: removeUnsupportedBlockType(innerBlocks),
    }
  })
}
