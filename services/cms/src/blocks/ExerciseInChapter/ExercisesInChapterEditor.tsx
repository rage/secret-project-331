import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const ALLOWED_NESTED_BLOCKS = [""]

const ExercisesInChapterEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, never>>>
> = ({ clientId }) => {
  const { t } = useTranslation()
  return (
    <BlockPlaceholderWrapper id={clientId}>
      <h3>{t("exercises-in-chapter-placeholder")}</h3>
      <p>{t("exercises-in-chapter-placeholder-explanation")}</p>
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </BlockPlaceholderWrapper>
  )
}

export default ExercisesInChapterEditor
