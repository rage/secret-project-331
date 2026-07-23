"use client"

import { css } from "@emotion/css"
import type { ReactNode } from "react"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"

interface ContentDisplayBoxProps {
  label: string
  content?: ReactNode
}

const ContentDisplayBox: React.FC<ContentDisplayBoxProps> = ({ label, content }) => {
  const { t } = useTranslation()
  return (
    <div
      className={css`
        border-radius: 0.5rem;
        border: 1px solid ${baseTheme.colors.blue[200]};
        background: ${baseTheme.colors.blue[25]};
        padding: 0.75rem 1rem;
        flex-grow: 1;
      `}
    >
      <div
        className={css`
          font-size: 1rem;
          font-weight: 600;
          color: ${baseTheme.colors.gray[800]};
          margin: 0 0 0.5rem 0;
        `}
      >
        {label}
      </div>
      <div
        className={css`
          font-size: 0.85rem;
          color: ${baseTheme.colors.gray[700]};
          margin: 0.35rem 0;
        `}
      >
        {content ? content : t("label-null")}
      </div>
    </div>
  )
}

export default ContentDisplayBox
