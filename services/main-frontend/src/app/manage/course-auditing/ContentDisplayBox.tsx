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

const ContentDisplayBox: React.FC<React.PropsWithChildren<ContentDisplayBoxProps>> = ({
  label,
  content,
}) => {
  const { t } = useTranslation()
  return (
    <div
      className={css`
        margin-top: 0.5rem;
        border-radius: 0.5rem;
        border: 1px solid ${baseTheme.colors.blue[200]};
        background: ${baseTheme.colors.blue[25]};
        padding: 0.85rem 1rem;
      `}
    >
      <p
        className={css`
          font-size: 0.9rem;
          font-weight: 600;
          color: ${baseTheme.colors.gray[800]};
          margin: 0 0 0.5rem 0;
        `}
      >
        {label}
      </p>
      <p
        className={css`
          font-size: 0.85rem;
          color: ${baseTheme.colors.gray[700]};
          margin: 0.35rem 0;
          line-height: 1.5;
        `}
      >
        {content ? content : t("label-null")}
      </p>
    </div>
  )
}

export default ContentDisplayBox
