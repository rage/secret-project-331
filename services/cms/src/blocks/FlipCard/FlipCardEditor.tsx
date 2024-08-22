/* eslint-disable i18next/no-literal-string */
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps, TemplateArray } from "@wordpress/blocks"
import React from "react"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"
import BlockWrapper from "../BlockWrapper"

const ALLOWED_NESTED_BLOCKS = ["core/image", "core/paragraph"]
const INNER_BLOCKS_TEMPLATE: TemplateArray = [
  ["moocfi/front-card", {}],
  ["moocfi/back-card", {}],
]

const FlipCardEditor: React.FC<React.PropsWithChildren<BlockEditProps<Record<string, never>>>> = ({
  clientId,
}) => {
  return (
    <BlockPlaceholderWrapper
      id={"flip-card"}
      title={"Flip card"}
      explanation={"Add a front and a back card for the flip card"}
    >
      <BlockWrapper id={clientId}>
        <div>
          <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} template={INNER_BLOCKS_TEMPLATE} />
        </div>
      </BlockWrapper>
    </BlockPlaceholderWrapper>
  )
}
export default FlipCardEditor
