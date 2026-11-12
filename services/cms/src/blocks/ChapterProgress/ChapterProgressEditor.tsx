"use client"

import React from "react"

import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const ChapterProgressEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, never>>>
> = () => {
  const { t } = useTranslation()
  return (
    <BlockPlaceholderWrapper
      title={t("chapter-progress-placeholder")}
      explanation={t("chapter-progress-placeholder-explanation")}
    />
  )
}

export default ChapterProgressEditor
