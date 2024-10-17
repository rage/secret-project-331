/* eslint-disable i18next/no-literal-string */
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"

import BlockPlaceholderWrapper from "../../BlockPlaceholderWrapper"

import { ConditionAttributes } from "."

const ALLOWED_NESTED_BLOCKS = ["core/heading", "core/paragraph", "core/image", "core/list"]

const RevealableHiddenContentEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<ConditionAttributes>>
> = ({ clientId }) => {
  return (
    <BlockPlaceholderWrapper
      id={clientId}
      title="Hidden content"
      explanation="The content in this block is hidden until student clicks a button"
    >
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </BlockPlaceholderWrapper>
  )
}

export default RevealableHiddenContentEditor
