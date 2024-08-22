/* eslint-disable i18next/no-literal-string */
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"

import BlockPlaceholderWrapper from "../../BlockPlaceholderWrapper"
import BlockWrapper from "../../BlockWrapper"

const ALLOWED_NESTED_BLOCKS = ["core/image", "core/paragraph"]

const FrontCardEditor: React.FC<React.PropsWithChildren<BlockEditProps<Record<string, never>>>> = ({
  clientId,
}) => {
  return (
    <BlockPlaceholderWrapper
      id={"Front-card"}
      title={"Front card"}
      explanation={"Add a frontcard for the Front card"}
    >
      <BlockWrapper id={clientId}>
        <div>
          <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
        </div>
      </BlockWrapper>
    </BlockPlaceholderWrapper>
  )
}
export default FrontCardEditor
