"use client"

import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

const ALLOWED_NESTED_BLOCKS = [""]

const ExercisesInChapterEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, never>>>
> = ({ clientId }) => {
  const { t } = useTranslation()
  return (
    <BlockPlaceholderWrapper
      id={clientId}
      title={t("exercises-in-chapter-placeholder")}
      explanation={t("exercises-in-chapter-placeholder-explanation")}
    >
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </BlockPlaceholderWrapper>
  )
}

export default ExercisesInChapterEditor
