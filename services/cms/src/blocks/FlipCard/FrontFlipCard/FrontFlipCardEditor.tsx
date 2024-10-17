import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import BlockPlaceholderWrapper from "../../BlockPlaceholderWrapper"

const ALLOWED_NESTED_BLOCKS = ["core/image", "core/paragraph", "core/heading", "core/list"]

const FrontFlipCardEditor: React.FC<BlockEditProps<Record<string, never>>> = ({ clientId }) => {
  const { t } = useTranslation()

  return (
    <BlockPlaceholderWrapper
      id={clientId}
      title={t("front-card")}
      explanation={t("front-card-explanation")}
    >
      <div>
        <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} templateLock={false} />
      </div>
    </BlockPlaceholderWrapper>
  )
}
export default FrontFlipCardEditor
