import { BlockEditProps } from "@wordpress/blocks"
import React from "react"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const UnsupportedEditor: React.FC<BlockEditProps<Record<string, never>>> = ({ clientId }) => {
  return (
    <BlockPlaceholderWrapper id={clientId}>
      <h3>Unsupported block placeholder</h3>
      <p>This block is used as placeholder for blocks that are unsupported.</p>
    </BlockPlaceholderWrapper>
  )
}

export default UnsupportedEditor
