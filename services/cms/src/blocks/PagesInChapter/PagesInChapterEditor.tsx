"use client"

import { InnerBlocks } from "@wordpress/block-editor"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import React from "react"
import { useTranslation } from "@/utils/useCmsTranslation"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const ALLOWED_NESTED_BLOCKS = [""]

const PagesInChapterEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, never>>>
> = ({ clientId }) => {
  const { t } = useTranslation()
  return (
    <BlockPlaceholderWrapper
      id={clientId}
      title={t("pages-in-chapter-placeholder")}
      explanation={t("pages-in-chapter-placeholder-explanation")}
    >
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </BlockPlaceholderWrapper>
  )
}

export default PagesInChapterEditor
