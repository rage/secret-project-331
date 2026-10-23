"use client"

/* oxlint-disable i18next/no-literal-string */
import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"

import { registeredInnerBlocksProps } from "@/utils/Gutenberg/registeredInnerBlocksProps"
import type { BlockEditProps } from "@/utils/Gutenberg/types"

import type { ConditionAttributes } from "."
import BlockPlaceholderWrapper from "../../BlockPlaceholderWrapper"

const RevealableHiddenContentEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<ConditionAttributes>>
> = ({ name }) => {
  return (
    <BlockPlaceholderWrapper
      title="Hidden content"
      explanation="The content in this block is hidden until student clicks a button"
    >
      <InnerBlocks {...registeredInnerBlocksProps(name)} />
    </BlockPlaceholderWrapper>
  )
}

export default RevealableHiddenContentEditor
