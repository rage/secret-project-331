"use client"

import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"

import { registeredInnerBlocksProps } from "@/utils/Gutenberg/registeredInnerBlocksProps"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const CongratulationsEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, never>>>
> = ({ name }) => {
  const { t } = useTranslation()
  return (
    <BlockPlaceholderWrapper
      title={t("congratulations-placeholder")}
      explanation={t("congratulations-explanation")}
    >
      <InnerBlocks {...registeredInnerBlocksProps(name)} />
    </BlockPlaceholderWrapper>
  )
}

export default CongratulationsEditor
