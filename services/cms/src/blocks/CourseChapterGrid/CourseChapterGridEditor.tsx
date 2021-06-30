import { BlockEditProps } from "@wordpress/blocks"
import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const ALLOWED_NESTED_BLOCKS = [""]

const CourseGridEditor: React.FC<BlockEditProps<Record<string, never>>> = ({ clientId }) => {
  return (
    <BlockPlaceholderWrapper id={clientId}>
      <h3>Chapters Grid Placeholder</h3>
      <p>
        This block is placed on the course material front page for navigating to different chapters
        easily.
      </p>
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </BlockPlaceholderWrapper>
  )
}

export default CourseGridEditor
