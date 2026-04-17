"use client"

import type { BlockEditProps } from "@/utils/Gutenberg/types"
import React from "react"
import { useTranslation } from "@/utils/useCmsTranslation"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const UnsupportedEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, never>>>
> = ({ clientId }) => {
  const { t } = useTranslation()
  return (
    <BlockPlaceholderWrapper
      id={clientId}
      title={t("unsupported-block-placeholder")}
      explanation={t("unsupported-block-placeholder-explanation")}
    ></BlockPlaceholderWrapper>
  )
}

export default UnsupportedEditor
