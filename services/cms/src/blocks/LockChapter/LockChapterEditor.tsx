"use client"

import { css } from "@emotion/css"
import { Padlock } from "@vectopus/atlas-icons-react"
import { InnerBlocks, useBlockProps } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import { Notice } from "@wordpress/components"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme, primaryFont } from "@/shared-module/common/styles"

const ALLOWED_NESTED_BLOCKS = [
  "core/heading",
  "core/paragraph",
  "core/image",
  "core/video",
  "core/code",
  "core/list",
  "core/quote",
  "core/table",
  "moocfi/latex",
  "moocfi/iframe",
  "moocfi/audio-upload",
]

const LockChapterEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, never>>>
> = () => {
  const { t } = useTranslation()
  // eslint-disable-next-line i18next/no-literal-string
  const blockProps = useBlockProps({ className: "moocfi-lock-chapter" })

  return (
    <div {...blockProps}>
      <div
        className={css`
          background: ${baseTheme.colors.clear[100]};
          border: 1px solid ${baseTheme.colors.gray[300]};
          border-radius: 4px;
          padding: 1.5rem;
          margin: 1rem 0;
        `}
      >
        <div
          className={css`
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 1.25rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid ${baseTheme.colors.gray[200]};
          `}
        >
          <div
            className={css`
              color: ${baseTheme.colors.blue[600]};
              display: flex;
              align-items: center;
            `}
          >
            <Padlock size={24} />
          </div>
          <h3
            className={css`
              margin: 0;
              font-family: ${primaryFont};
              font-size: 1.25rem;
              font-weight: 600;
              color: ${baseTheme.colors.gray[700]};
            `}
          >
            {t("lock-chapter-editor-title")}
          </h3>
        </div>

        <div
          className={css`
            margin-bottom: 1.5rem;
          `}
        >
          <p
            className={css`
              margin: 0 0 1rem 0;
              font-family: ${primaryFont};
              font-size: 0.9375rem;
              line-height: 1.6;
              color: ${baseTheme.colors.gray[600]};
            `}
          >
            {t("lock-chapter-editor-description")}
          </p>

          <Notice
            // eslint-disable-next-line i18next/no-literal-string
            status="info"
            isDismissible={false}
            className={css`
              margin: 0;
            `}
          >
            {t("lock-chapter-inner-blocks-help")}
          </Notice>
        </div>

        <div
          className={css`
            margin-top: 1.5rem;
            padding-top: 1.5rem;
            border-top: 1px solid ${baseTheme.colors.gray[200]};
            width: 100%;
            box-sizing: border-box;
          `}
        >
          <label
            className={css`
              display: block;
              margin-bottom: 0.75rem;
              font-family: ${primaryFont};
              font-size: 0.875rem;
              font-weight: 600;
              color: ${baseTheme.colors.gray[700]};
            `}
          >
            {t("lock-chapter-inner-blocks-label")}
          </label>
          <div
            className={css`
              background: ${baseTheme.colors.clear[100]};
              border: 1px dashed ${baseTheme.colors.gray[300]};
              border-radius: 4px;
              padding: 1rem;
              min-height: 100px;
              width: 100%;
              box-sizing: border-box;
              & > * {
                width: 100%;
              }
            `}
          >
            <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default LockChapterEditor
