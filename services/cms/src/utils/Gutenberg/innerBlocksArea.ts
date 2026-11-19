import type { BlockType } from "./types"

/** Whether a block has an InnerBlocks area at all; a block without one can't hold children. */
export const hasInnerBlocksArea = (
  blockType: Pick<BlockType, "allowedBlocks" | "innerBlocksArea" | "supports">,
): boolean =>
  Array.isArray(blockType.allowedBlocks) ||
  blockType.innerBlocksArea !== undefined ||
  (blockType.supports as Record<string, unknown> | undefined)?.allowedBlocks === true
