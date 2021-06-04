import { BlockInstance } from "@wordpress/blocks"
import { v4 as uuid } from "uuid"

/**
 * Not the way to do this, but we can't use wordpress own api if we don't have an Editor instance where we can register blocks
 * TODO: Figure out how to create blocks using wordpress API
 * @param name
 * @param attributes
 * @param innerBlocks
 * @returns
 */
export function createBlockInstance(
  name: string,
  attributes = {},
  innerBlocks: BlockInstance[] = [],
): BlockInstance {
  // const sanitizedAttributes = sanitizeBlockAttributes( name, attributes );

  const clientId = uuid()

  // Blocks are stored with a unique ID, the assigned type name, the block
  // attributes, and their inner blocks.
  return {
    clientId,
    name,
    isValid: true,
    attributes: attributes,
    innerBlocks,
  }
}
