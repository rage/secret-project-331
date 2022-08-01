import { BlockEditProps } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const UnsupportedEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, never>>>
> = ({ clientId }) => {
  const { t } = useTranslation()
  return (
    <BlockPlaceholderWrapper id={clientId}>
      <h3>{t("unsupported-block-placeholder")}</h3>
      <p>{t("unsupported-block-placeholder-explanation")}</p>
    </BlockPlaceholderWrapper>
  )
}

export default UnsupportedEditor
