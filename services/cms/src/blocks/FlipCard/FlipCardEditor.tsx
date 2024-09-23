import { InnerBlocks, InspectorControls } from "@wordpress/block-editor"
import { BlockEditProps, TemplateArray } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

import { FlipCardAttributes } from "."

import FlipBoxSizeCustomizer from "@/components/blocks/FlipCardSizeCustomizer"

const ALLOWED_NESTED_BLOCKS = ["moocfi/inner-card"]
const INNER_BLOCKS_TEMPLATE: TemplateArray = [
  ["moocfi/inner-card", {}],
  ["moocfi/inner-card", {}],
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
        <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} template={INNER_BLOCKS_TEMPLATE} />
      </div>
    </BlockPlaceholderWrapper>
  )
}
export default FlipCardEditor
