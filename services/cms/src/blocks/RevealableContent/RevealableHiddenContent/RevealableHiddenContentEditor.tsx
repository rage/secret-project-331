import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"

import BlockPlaceholderWrapper from "../../BlockPlaceholderWrapper"

import { ConditionAttributes } from "."

const ALLOWED_NESTED_BLOCKS = ["core/heading", "core/paragraph"]

const RevealableHiddenContentEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<ConditionAttributes>>
> = ({ clientId }) => {
  return (
    // eslint-disable-next-line i18next/no-literal-string
    <BlockPlaceholderWrapper id={clientId} title="Revealable Block" explanation={""}>
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </BlockPlaceholderWrapper>
  )
}

export default RevealableHiddenContentEditor
