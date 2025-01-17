import { css } from "@emotion/css"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import BlockPlaceholderWrapper from "../../BlockPlaceholderWrapper"

const ALLOWED_NESTED_BLOCKS = ["core/image", "core/paragraph", "core/heading", "core/list"]

const BackFlipCardEditor: React.FC<BlockEditProps<Record<string, never>>> = ({ clientId }) => {
  const { t } = useTranslation()

  return (
    <BlockPlaceholderWrapper
      id={clientId}
      title={t("back-card")}
      explanation={t("back-card-explanation")}
    >
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
