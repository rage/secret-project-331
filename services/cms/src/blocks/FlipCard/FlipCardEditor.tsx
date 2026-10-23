"use client"

import { css } from "@emotion/css"
import { InnerBlocks, InspectorControls } from "@wordpress/block-editor"
import React from "react"

import FlipBoxSizeCustomizer from "@/components/blocks/FlipCardSizeCustomizer"
import { registeredInnerBlocksProps } from "@/utils/Gutenberg/registeredInnerBlocksProps"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import type { FlipCardAttributes } from "."
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const FlipCardEditor: React.FC<React.PropsWithChildren<BlockEditProps<FlipCardAttributes>>> = ({
  name,
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
        <InnerBlocks {...registeredInnerBlocksProps(name)} />
      </div>
    </BlockPlaceholderWrapper>
  )
}
export default FlipCardEditor
