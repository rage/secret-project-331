"use client"

import React from "react"

import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

const EmailTeacherNewsletterEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, never>>>
> = () => {
  const { t } = useTranslation()

  return (
    <BlockPlaceholderWrapper
      title={t("teacher-newsletter-placeholder")}
      explanation={t("teacher-newsletter-placeholder-explanation")}
    />
  )
}

export default EmailTeacherNewsletterEditor
