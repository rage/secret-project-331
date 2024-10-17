import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import { t } from "i18next"
import React from "react"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

import { ConditionAttributes } from "."

const ALLOWED_NESTED_BLOCKS = [
  "core/heading",
  "core/paragraph",
  "core/image",
  "core/list",
  "moocfi/revealable-hidden-content",
]

const ConditionalBlockEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<ConditionAttributes>>
> = ({ clientId }) => {
  return (
    <BlockPlaceholderWrapper
      id={clientId}
      title={t("revealable-content-placeholder")}
      explanation={t("revealable-content-explanation")}
    >
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </BlockPlaceholderWrapper>
  )
}

export default ConditionalBlockEditor
