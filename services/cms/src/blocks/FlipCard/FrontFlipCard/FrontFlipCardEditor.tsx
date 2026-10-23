"use client"

import { css } from "@emotion/css"
import React from "react"

import RegisteredInnerBlocks from "@/utils/Gutenberg/RegisteredInnerBlocks"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import BlockPlaceholderWrapper from "../../BlockPlaceholderWrapper"

const FrontFlipCardEditor: React.FC<BlockEditProps<Record<string, never>>> = () => {
  const { t } = useTranslation()

  return (
    <BlockPlaceholderWrapper title={t("front-card")} explanation={t("front-card-explanation")}>
      <div
        className={css`
          width: 100%;
        `}
      >
        <RegisteredInnerBlocks />
      </div>
    </BlockPlaceholderWrapper>
  )
}
export default FrontFlipCardEditor
