import { BlockEditProps } from "@wordpress/blocks"
import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const ALLOWED_NESTED_BLOCKS = [""]

const PagesInPartEditor: React.FC<BlockEditProps<Record<string, never>>> = ({ clientId }) => {
  return (
    <BlockPlaceholderWrapper id={clientId}>
      <h3>Pages In Part Grid Placeholder</h3>
      <p>
        This block is placed on each part front page, e.g. /part-1/ for navigating to different sub
        sections easily.
      </p>
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </BlockPlaceholderWrapper>
  )
}

export default PagesInPartEditor
