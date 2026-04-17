"use client"

import { InnerBlocks } from "@wordpress/block-editor"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import React from "react"
import { useTranslation } from "@/utils/useCmsTranslation"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const ALLOWED_NESTED_BLOCKS = ["core/expandable-content-inner-block"]
const ExpandableContentEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, never>>>
> = ({ clientId }) => {
  const { t } = useTranslation()
  return (
    <BlockPlaceholderWrapper
      id={clientId}
      title={t("expandable-content-placeholder")}
      explanation={t("expandable-content-explanation")}
    >
      <div>
        <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
      </div>
    </BlockPlaceholderWrapper>
  )
}

export default ExpandableContentEditor
