/* eslint-disable i18next/no-literal-string */
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"

import BlockPlaceholderWrapper from "../../BlockPlaceholderWrapper"
import BlockWrapper from "../../BlockWrapper"

const ALLOWED_NESTED_BLOCKS = ["core/image", "core/paragraph"]

const BackCardEditor: React.FC<React.PropsWithChildren<BlockEditProps<Record<string, never>>>> = ({
  clientId,
}) => {
  return (
    <BlockPlaceholderWrapper
      id={"Back-card"}
      title={"Back card"}
      explanation={"Add a Back card for the flip card"}
    >
      <BlockWrapper id={clientId}>
        <div>
          <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
        </div>
      </BlockWrapper>
    </BlockPlaceholderWrapper>
  )
}
export default BackCardEditor
