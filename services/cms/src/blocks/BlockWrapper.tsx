"use client"

import { useBlockProps } from "@wordpress/block-editor"

/**
 * Wrapper for edible blocks.
 *
 * Must be the outermost element the block's `edit` renders: it carries the block wrapper props
 * Gutenberg needs from apiVersion 2 onwards for selection, dragging and toolbar anchoring.
 */
const BlockWrapper: React.FC<React.PropsWithChildren> = ({ children }) => {
  const blockProps = useBlockProps()

  return <div {...blockProps}>{children}</div>
}

export default BlockWrapper
