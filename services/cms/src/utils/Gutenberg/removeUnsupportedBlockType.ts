import { BlockInstance } from "@wordpress/blocks"

export function removeUnsupportedBlockType(blocks: BlockInstance[]): BlockInstance[] {
  const modifiedBlocks: BlockInstance[] = blocks.map((block) => {
    if (block.name === "moocfi/unsupported-block-type") {
      return block.attributes.originalBlockJson
    } else {
      return block
    }
  })
  return modifiedBlocks
}
