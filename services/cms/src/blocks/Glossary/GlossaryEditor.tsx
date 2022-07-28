import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const ALLOWED_NESTED_BLOCKS = [""]

const CourseGridEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, never>>>
> = ({ clientId }) => {
  const { t } = useTranslation()
  return (
    <BlockPlaceholderWrapper id={clientId}>
      <h3>{t("glossary-placeholder")}</h3>
      <p>{t("glossary-placeholder-explanation")}</p>
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </BlockPlaceholderWrapper>
  )
}

export default CourseGridEditor
