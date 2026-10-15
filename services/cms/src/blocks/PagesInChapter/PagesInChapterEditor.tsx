"use client"

import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"

import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const ALLOWED_NESTED_BLOCKS = [""]

const PagesInChapterEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, never>>>
> = () => {
  const { t } = useTranslation()
  return (
    <BlockPlaceholderWrapper
      title={t("pages-in-chapter-placeholder")}
      explanation={t("pages-in-chapter-placeholder-explanation")}
    >
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </BlockPlaceholderWrapper>
  )
}

export default PagesInChapterEditor
