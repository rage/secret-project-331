import { BlockInstance } from "@wordpress/blocks"

export function UseBlocksWithUnsupportedBlocksRemoved(
  blocks: BlockInstance[],
  supportedBlocks: string[],
): BlockInstance[] {
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
