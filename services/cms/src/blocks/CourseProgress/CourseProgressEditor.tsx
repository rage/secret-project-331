"use client"

import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"

import { registeredInnerBlocksProps } from "@/utils/Gutenberg/registeredInnerBlocksProps"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const CourseProgressEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, never>>>
> = ({ name }) => {
  const { t } = useTranslation()
  return (
    <BlockPlaceholderWrapper
      title={t("course-progress-placeholder")}
      explanation={t("course-progress-placeholder-explanation")}
    >
      <InnerBlocks {...registeredInnerBlocksProps(name)} />
    </BlockPlaceholderWrapper>
  )
}

export default CourseProgressEditor
