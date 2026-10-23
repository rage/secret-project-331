"use client"

import { css } from "@emotion/css"
import React from "react"

import RegisteredInnerBlocks from "@/utils/Gutenberg/RegisteredInnerBlocks"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const ExpandableContentEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, never>>>
> = () => {
  const { t } = useTranslation()
  return (
    <BlockPlaceholderWrapper
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
        <RegisteredInnerBlocks />
      </div>
    </BlockPlaceholderWrapper>
  )
}

export default ExpandableContentEditor
