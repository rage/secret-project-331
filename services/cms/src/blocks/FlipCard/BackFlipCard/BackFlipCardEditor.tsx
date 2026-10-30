"use client"

import { css } from "@emotion/css"
import React from "react"

import RegisteredInnerBlocks from "@/utils/Gutenberg/RegisteredInnerBlocks"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import BlockPlaceholderWrapper from "../../BlockPlaceholderWrapper"

const BackFlipCardEditor: React.FC<BlockEditProps<Record<string, never>>> = () => {
  const { t } = useTranslation()

  return (
    <BlockPlaceholderWrapper title={t("back-card")} explanation={t("back-card-explanation")}>
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
export default BackFlipCardEditor
