import styled from "@emotion/styled"
import { BlockEditProps } from "@wordpress/blocks"
import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"
import { PagesInPartAttributes } from "."

const ALLOWED_NESTED_BLOCKS = [""]

const PagesInPartCard = styled.div`
  padding: 2rem;
  border: 1px solid black;
  border-radius: 2px;
`

const PagesInPartEditor: React.FC<BlockEditProps<PagesInPartAttributes>> = ({ clientId }) => {
  return (
    <PagesInPartCard id={clientId}>
      <h3>Pages In Part Grid Placeholder</h3>
      <p>
        This block is placed on each part front page, e.g. /part-1/ for navigating to different sub
        sections easily.
      </p>
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </PagesInPartCard>
  )
}

export default PagesInPartEditor
