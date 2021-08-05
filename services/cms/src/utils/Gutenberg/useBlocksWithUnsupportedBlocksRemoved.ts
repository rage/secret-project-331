import { BlockInstance } from "@wordpress/blocks"
import { useMemo } from "react"

export default function useBlocksWithUnsupportedBlocksRemoved(
  blocks: BlockInstance[],
  supportedBlocks: string[],
): BlockInstance[] {
  const memoizedBlocks = useMemo(
    () => modifyBlocks(blocks, supportedBlocks),
    [supportedBlocks, blocks],
  )
  return memoizedBlocks
}

const modifyBlocks = (blocks: BlockInstance[], supportedBlocks: string[]) => {
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
