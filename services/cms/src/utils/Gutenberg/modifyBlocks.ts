/* eslint-disable i18next/no-literal-string */
import { BlockInstance } from "@wordpress/blocks"

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
