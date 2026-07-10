"use client"

import { css } from "@emotion/css"
import { InnerBlocks, InspectorControls } from "@wordpress/block-editor"
import React from "react"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

import type { FlipCardAttributes } from "."

import FlipBoxSizeCustomizer from "@/components/blocks/FlipCardSizeCustomizer"
import type { BlockEditProps, TemplateArray } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

const ALLOWED_NESTED_BLOCKS = ["moocfi/front-card"]
const INNER_BLOCKS_TEMPLATE: TemplateArray = [
  ["moocfi/front-card", {}],
  ["moocfi/back-card", {}],
]

const FlipCardEditor: React.FC<React.PropsWithChildren<BlockEditProps<FlipCardAttributes>>> = ({
  clientId,
  attributes,
  setAttributes,
}) => {
  const { t } = useTranslation()

  return (
    <BlockPlaceholderWrapper
      id={clientId}
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
        <InnerBlocks
          allowedBlocks={ALLOWED_NESTED_BLOCKS}
          template={INNER_BLOCKS_TEMPLATE}
          templateLock="all"
        />
      </div>
    </BlockPlaceholderWrapper>
  )
}
export default FlipCardEditor
