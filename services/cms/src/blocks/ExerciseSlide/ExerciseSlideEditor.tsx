import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"

const ALLOWED_NESTED_BLOCKS = ["moocfi/exercise-task"]

const ExerciseSlideEditorCard = styled.div`
  padding: 2rem 0;
  margin-bottom: 2rem;
`

export interface ExerciseSlideAttributes {
  id: string
}

const ExerciseSlideEditor: React.FC<BlockEditProps<ExerciseSlideAttributes>> = ({ attributes }) => {
  return (
    <ExerciseSlideEditorCard id={attributes.id}>
      <div
        className={css`
          font-size: 18pt;
          font-weight: normal;
          margin-bottom: 1.5rem;
        `}
      >
        Slide
      </div>
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </ExerciseSlideEditorCard>
  )
}

export default ExerciseSlideEditor
