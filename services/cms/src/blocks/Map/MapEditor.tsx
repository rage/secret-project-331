"use client"

import React from "react"

import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const MapEditor: React.FC<React.PropsWithChildren<BlockEditProps<Record<string, never>>>> = () => {
  const { t } = useTranslation()
  return (
    <BlockPlaceholderWrapper
      title={t("map-block-placeholder")}
      explanation={t("map-block-placeholder-explanation")}
    />
  )
}

export default MapEditor
