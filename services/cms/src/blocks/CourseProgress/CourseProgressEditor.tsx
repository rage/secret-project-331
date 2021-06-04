import { BlockEditProps } from "@wordpress/blocks"
import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const ALLOWED_NESTED_BLOCKS = [""]

const CourseProgressEditor: React.FC<BlockEditProps<Record<string, never>>> = ({ clientId }) => {
  return (
    <BlockPlaceholderWrapper id={clientId}>
      <h3>Course Progress Placeholder</h3>
      <p>This block is placed on the course material where you wish to show course progres.</p>
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </BlockPlaceholderWrapper>
  )
}

export default CourseProgressEditor
