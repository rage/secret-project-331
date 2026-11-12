"use client"

import React from "react"

import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const ExercisesInChapterEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, never>>>
> = () => {
  const { t } = useTranslation()
  return (
    <BlockPlaceholderWrapper
      title={t("exercises-in-chapter-placeholder")}
      explanation={t("exercises-in-chapter-placeholder-explanation")}
    />
  )
}

export default ExercisesInChapterEditor
