"use client"

import { css } from "@emotion/css"
import { Padlock } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."
import InnerBlocks from "../../util/InnerBlocks"

import { baseTheme, primaryFont } from "@/shared-module/common/styles"

interface LockChapterLockedViewProps {
  blockProps: BlockRendererProps<unknown>
}

const LockChapterLockedView: React.FC<LockChapterLockedViewProps> = ({ blockProps }) => {
  const { t } = useTranslation()

  return (
    <div
      className={css`
        background: ${baseTheme.colors.green[50]};
        border: 2px solid ${baseTheme.colors.green[400]};
        border-radius: 8px;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      `}
    >
      <div
        className={css`
          display: flex;
          align-items: center;
          gap: 1rem;
        `}
      >
        <div
          className={css`
            color: ${baseTheme.colors.green[600]};
            display: flex;
            align-items: center;
            flex-shrink: 0;
          `}
        >
          <Padlock size={32} />
        </div>
        <div
          className={css`
            flex: 1;
          `}
        >
          <h3
            className={css`
              margin: 0 0 0.25rem 0;
              font-family: ${primaryFont};
              font-size: 1.125rem;
              font-weight: 600;
              color: ${baseTheme.colors.gray[700]};
            `}
          >
            {t("chapter-locked-message")}
          </h3>
          <p
            className={css`
              margin: 0;
              font-family: ${primaryFont};
              font-size: 0.9375rem;
              color: ${baseTheme.colors.gray[600]};
            `}
          >
            {t("chapter-locked-description")}
          </p>
        </div>
      </div>
      {blockProps.data.innerBlocks && blockProps.data.innerBlocks.length > 0 && (
        <div
          className={css`
            padding-top: 1.5rem;
            border-top: 1px solid ${baseTheme.colors.green[300]};
          `}
        >
          <InnerBlocks
            parentBlockProps={blockProps}
            dontAllowInnerBlocksToBeWiderThanParentBlock={true}
          />
        </div>
      )}
    </div>
  )
}

export default LockChapterLockedView
