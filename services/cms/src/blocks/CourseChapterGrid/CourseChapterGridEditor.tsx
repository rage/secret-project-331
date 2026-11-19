"use client"

import React from "react"

import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const CourseGridEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, never>>>
> = () => {
  const { t } = useTranslation()
  return (
    <BlockPlaceholderWrapper
      title={t("chapters-grid-placeholder")}
      explanation={t("chapters-grid-placeholder-explanation")}
    />
  )
}

export default CourseGridEditor
