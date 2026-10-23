"use client"

import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"

import { registeredInnerBlocksProps } from "@/utils/Gutenberg/registeredInnerBlocksProps"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import type { ConditionAttributes } from "."
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const ConditionalBlockEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<ConditionAttributes>>
> = ({ name }) => {
  const { t } = useTranslation()

  return (
    <BlockPlaceholderWrapper
      title={t("revealable-content-placeholder")}
      explanation={t("revealable-content-explanation")}
    >
      <InnerBlocks {...registeredInnerBlocksProps(name)} />
    </BlockPlaceholderWrapper>
  )
}

export default ConditionalBlockEditor
