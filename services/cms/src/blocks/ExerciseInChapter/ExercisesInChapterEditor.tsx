import { BlockEditProps } from "@wordpress/blocks"
import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const ALLOWED_NESTED_BLOCKS = [""]

const ExercisesInChapterEditor: React.FC<BlockEditProps<Record<string, never>>> = ({
  clientId,
}) => {
  return (
    <BlockPlaceholderWrapper id={clientId}>
      <h3>Exercises In Chapter Placeholder</h3>
      <p>
        This block is placed on each chapter front page, e.g. /chapter-1/ for listing and navigating
        to different exercises within chapter.
      </p>
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </BlockPlaceholderWrapper>
  )
}

export default ExercisesInChapterEditor
