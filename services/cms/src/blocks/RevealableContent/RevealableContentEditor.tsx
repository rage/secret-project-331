"use client"

import React from "react"

import RegisteredInnerBlocks from "@/utils/Gutenberg/RegisteredInnerBlocks"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import type { ConditionAttributes } from "."
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const ConditionalBlockEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<ConditionAttributes>>
> = () => {
  const { t } = useTranslation()

  return (
    <BlockPlaceholderWrapper
      title={t("revealable-content-placeholder")}
      explanation={t("revealable-content-explanation")}
    >
      <RegisteredInnerBlocks />
    </BlockPlaceholderWrapper>
  )
}

export default ConditionalBlockEditor
