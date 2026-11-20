"use client"

/* oxlint-disable i18next/no-literal-string */
import React from "react"

import RegisteredInnerBlocks from "@/utils/Gutenberg/RegisteredInnerBlocks"
import type { BlockEditProps } from "@/utils/Gutenberg/types"

import type { ConditionAttributes } from "."
import BlockPlaceholderWrapper from "../../BlockPlaceholderWrapper"

const RevealableHiddenContentEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<ConditionAttributes>>
> = () => {
  return (
    <BlockPlaceholderWrapper
      title="Hidden content"
      explanation="The content in this block is hidden until student clicks a button"
    >
      <RegisteredInnerBlocks />
    </BlockPlaceholderWrapper>
  )
}

export default RevealableHiddenContentEditor
