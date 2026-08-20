"use client"

import { css } from "@emotion/css"
import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"

import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import BlockPlaceholderWrapper from "../../BlockPlaceholderWrapper"

const ALLOWED_NESTED_BLOCKS = ["core/image", "core/paragraph", "core/heading", "core/list"]

const BackFlipCardEditor: React.FC<BlockEditProps<Record<string, never>>> = () => {
  const { t } = useTranslation()

  return (
    <BlockPlaceholderWrapper title={t("back-card")} explanation={t("back-card-explanation")}>
      <div
        className={css`
          width: 100%;
        `}
      >
        <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} templateLock={false} />
      </div>
    </BlockPlaceholderWrapper>
  )
}
export default BackFlipCardEditor
