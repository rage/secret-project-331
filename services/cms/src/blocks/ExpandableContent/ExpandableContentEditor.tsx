"use client"

import { css } from "@emotion/css"
import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

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
      <div
        className={css`
          width: 100%;
          .block-editor-inner-blocks,
          .block-editor-block-list__layout {
            width: 100%;
          }
        `}
      >
        <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
      </div>
    </BlockPlaceholderWrapper>
  )
}

export default ExpandableContentEditor
