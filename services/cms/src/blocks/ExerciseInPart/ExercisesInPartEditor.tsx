import styled from "@emotion/styled"
import { BlockEditProps } from "@wordpress/blocks"
import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"
import { ExercisesInPartAttributes } from "."

const ALLOWED_NESTED_BLOCKS = [""]

const ExercisesInPartCard = styled.div`
  padding: 2rem;
  border: 1px solid black;
  border-radius: 2px;
`

const ExercisesInPartEditor: React.FC<BlockEditProps<ExercisesInPartAttributes>> = ({
  clientId,
}) => {
  return (
    <ExercisesInPartCard id={clientId}>
      <h3>Exercises In Part Placeholder</h3>
      <p>
        This block is placed on each part front page, e.g. /part-1/ for listing and navigating to
        different exercises within part.
      </p>
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </ExercisesInPartCard>
  )
}

export default ExercisesInPartEditor
