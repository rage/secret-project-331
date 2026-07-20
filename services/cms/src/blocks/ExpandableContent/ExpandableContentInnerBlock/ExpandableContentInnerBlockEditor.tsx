"use client"

import { css } from "@emotion/css"
import { InnerBlocks, useBlockProps } from "@wordpress/block-editor"
import React from "react"

import TextField from "@/shared-module/common/components/InputFields/TextField"
import { baseTheme, fontWeights, headingFont, primaryFont } from "@/shared-module/common/styles"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import type { ExpandableContentConfigurationProps } from "."

const ALLOWED_NESTED_BLOCKS = [
  "core/heading",
  "core/paragraph",
  "core/image",
  "core/list",
  "core/html",
]
const ExpandableContentInnerBlockEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<ExpandableContentConfigurationProps>>
> = ({ clientId, attributes, setAttributes }) => {
  const { t } = useTranslation()
  // oxlint-disable-next-line i18next/no-literal-string
  const blockProps = useBlockProps({ className: "moocfi-expandable-content-inner-block" })

  return (
    <div {...blockProps} id={`placeholder-block-${clientId}`}>
      <div
        className={css`
          display: flex;
          flex-direction: column;
          width: 100%;
          box-sizing: border-box;
          padding: 1rem;
          border-radius: 4px;
          border: 1px solid ${baseTheme.colors.gray[400]};
          background: ${baseTheme.colors.clear[100]};
          margin: 0.5rem 0;
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
          {t("expandable-content-section-title")}
        </p>
        <div
          className={css`
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding-bottom: 0.875rem;
            font-family: ${headingFont};
            color: ${baseTheme.colors.gray[700]};
          `}
        >
          <TextField
            placeholder={t("label-title")}
            value={attributes.name}
            onChangeByValue={(value) => setAttributes({ name: value })}
            className={css`
              margin: 0 !important;
              width: 100%;
              h4,
              label {
                margin: 0;
              }
              input {
                border: 1px solid ${baseTheme.colors.gray[500]} !important;
                border-radius: 4px !important;
                background: ${baseTheme.colors.clear[100]} !important;
                font-family: ${headingFont};
                font-weight: ${fontWeights.semibold};
                color: ${baseTheme.colors.gray[700]};
              }
            `}
          />
        </div>
        <p
          className={css`
            margin: 0 0 0.5rem 0;
            font-family: ${primaryFont};
            font-size: 0.8125rem;
            color: ${baseTheme.colors.gray[700]};
            font-weight: ${fontWeights.medium};
          `}
        >
          {t("expandable-content-section-content")}
        </p>
        <div
          className={css`
            background: ${baseTheme.colors.clear[100]};
            border: 1px dashed ${baseTheme.colors.gray[600]};
            border-radius: 4px;
            padding: 1rem;
            width: 100%;
            box-sizing: border-box;
            .block-editor-block-list__layout {
              width: 100%;
            }
          `}
        >
          <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
        </div>
      </div>
    </div>
  )
}

export default ExpandableContentInnerBlockEditor
