import { InnerBlocks, InspectorControls } from "@wordpress/block-editor"
import { BlockEditProps, TemplateArray } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

import { FlipCardAttributes } from "."

import FlipBoxSizeCustomizer from "@/components/blocks/FlipCardSizeCustomizer"

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
      <div>
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
