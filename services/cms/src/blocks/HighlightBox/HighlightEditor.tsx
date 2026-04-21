"use client"

import { css } from "@emotion/css"
import { RichText } from "@wordpress/block-editor"
import React from "react"

import BlockWrapper from "../BlockWrapper"

import { HighlightAttributes } from "."

import { baseTheme, fontWeights, monospaceFont, primaryFont } from "@/shared-module/common/styles"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

const HighlightEditor: React.FC<React.PropsWithChildren<BlockEditProps<HighlightAttributes>>> = ({
  clientId,
  attributes,
  setAttributes,
}) => {
  const { t } = useTranslation()
  const { title, content } = attributes

  return (
    <BlockWrapper id={clientId}>
      <div
        className={css`
          background: #fafbfb;
          border: 1px solid #e2e4e6;
          padding: 1rem 0;
        `}
      >
        <div
          className={css`
            max-width: 48rem;
            margin-left: auto;
            margin-right: auto;
            padding: 0 1.375rem;
          `}
        >
          <p
            className={css`
              margin: 0 0 0.5rem 0;
              font-family: ${primaryFont};
              font-size: 0.8125rem;
              color: ${baseTheme.colors.gray[700]};
              font-weight: ${fontWeights.medium};
            `}
          >
            {t("highlight-box-title-label")}
          </p>
          <RichText
            className={css`
              display: block;
              width: 100%;
              border: 1px solid ${baseTheme.colors.gray[500]};
              border-radius: 4px;
              padding: 0.5rem 0.75rem;
              background: #ffffff;
              color: ${baseTheme.colors.green[700]};
              font-weight: 700;
              font-family: ${monospaceFont};
              margin-bottom: 0.875rem;
            `}
            tagName="div"
            value={title}
            onChange={(value: string) => setAttributes({ title: value })}
            placeholder={t("highlight-box-title-placeholder")}
          />
          <p
            className={css`
              margin: 0 0 0.5rem 0;
              font-family: ${primaryFont};
              font-size: 0.8125rem;
              color: ${baseTheme.colors.gray[700]};
              font-weight: ${fontWeights.medium};
            `}
          >
            {t("highlight-box-content-label")}
          </p>
          <RichText
            className={css`
              display: block;
              width: 100%;
              min-height: 2rem;
              border: 1px solid ${baseTheme.colors.gray[500]};
              border-radius: 4px;
              padding: 0.5rem 0.75rem;
              background: #ffffff;
            `}
            tagName="div"
            value={content}
            onChange={(value: string) => setAttributes({ content: value })}
            placeholder={t("highlight-box-content-placeholder")}
          />
        </div>
      </div>
    </BlockWrapper>
  )
}

export default HighlightEditor
