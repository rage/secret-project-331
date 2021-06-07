import { BlockEditProps } from "@wordpress/blocks"
import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const ALLOWED_NESTED_BLOCKS = [""]

const PagesInChapterEditor: React.FC<BlockEditProps<Record<string, never>>> = ({ clientId }) => {
  return (
    <BlockPlaceholderWrapper id={clientId}>
      <h3>Pages In Chapter Grid Placeholder</h3>
      <p>
        This block is placed on each chapter front page, e.g. /chapter-1/ for navigating to
        different sub sections easily.
      </p>
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </BlockPlaceholderWrapper>
  )
}

export default PagesInChapterEditor
