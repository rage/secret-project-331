import { getBlockType } from "@wordpress/blocks"

import type { BlockType, TemplateArray, TemplateLock } from "./types"

interface RegisteredInnerBlocksProps {
  allowedBlocks?: string[]
  template?: TemplateArray
  templateLock?: TemplateLock
}

/**
 * `InnerBlocks` props from the block's registration, so the editor offers exactly the nesting the
 * headless block validator accepts.
 */
export const registeredInnerBlocksProps = (blockName: string): RegisteredInnerBlocksProps => {
  const blockType = getBlockType(blockName) as BlockType | undefined
  const props: RegisteredInnerBlocksProps = {}
  if (blockType?.allowedBlocks) {
    props.allowedBlocks = blockType.allowedBlocks
  }
  if (blockType?.innerBlocksArea?.template) {
    props.template = blockType.innerBlocksArea.template
  }
  if (blockType?.innerBlocksArea?.templateLock !== undefined) {
    props.templateLock = blockType.innerBlocksArea.templateLock
  }
  return props
}
