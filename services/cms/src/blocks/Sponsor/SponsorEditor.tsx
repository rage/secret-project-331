import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"

import BlockWrapper from "../BlockWrapper"

/* const ALLOWED_NESTED_BLOCKS = [""] */

const SponsorEditor: React.FC<BlockEditProps<Record<string, never>>> = ({ clientId }) => {
  return (
    <BlockWrapper id={clientId}>
      <div>
        <InnerBlocks />
      </div>
    </BlockWrapper>
  )
}

export default SponsorEditor
