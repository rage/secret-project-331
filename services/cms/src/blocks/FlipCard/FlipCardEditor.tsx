"use client"

import { css } from "@emotion/css"
import { InspectorControls } from "@wordpress/block-editor"
import React from "react"

import FlipBoxSizeCustomizer from "@/components/blocks/FlipCardSizeCustomizer"
import RegisteredInnerBlocks from "@/utils/Gutenberg/RegisteredInnerBlocks"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import type { FlipCardAttributes } from "."
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const FlipCardEditor: React.FC<React.PropsWithChildren<BlockEditProps<FlipCardAttributes>>> = ({
  attributes,
  setAttributes,
}) => {
  const { t } = useTranslation()

  return (
    <BlockPlaceholderWrapper
      title={t("flip-card-placeholder")}
      explanation={t("flip-card-placeholder-explanation")}
    >
      <InspectorControls key="flip-card-settings">
        <FlipBoxSizeCustomizer attributes={attributes} setAttributes={setAttributes} />
      </InspectorControls>
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
export default FlipCardEditor
