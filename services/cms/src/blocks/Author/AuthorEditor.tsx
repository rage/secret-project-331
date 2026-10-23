"use client"

import { css } from "@emotion/css"
import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"

import { baseTheme, headingFont } from "@/shared-module/common/styles"
import { registeredInnerBlocksProps } from "@/utils/Gutenberg/registeredInnerBlocksProps"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import BlockWrapper from "../BlockWrapper"

const AuthorEditor: React.FC<React.PropsWithChildren<BlockEditProps<Record<string, never>>>> = ({
  name,
}) => {
  const { t } = useTranslation()
  return (
    <BlockWrapper>
      <div>
        <div
          className={css`
            padding: 1rem;
            background: ${baseTheme.colors.clear[100]};
            text-align: center;
            font-family: ${headingFont};
          `}
        >
          <h4>{t("authors-block")}</h4>
          <span
            className={css`
              color: ${baseTheme.colors.gray[600]};
              text-align: center;
              font-weight: 500;
              display: inline-block;
              margin-bottom: 1.4rem;
              font-family: ${headingFont};
            `}
          >
            {t("authors-block-description")}
          </span>

          <div>
            <InnerBlocks {...registeredInnerBlocksProps(name)} />
          </div>
        </div>
      </div>
    </BlockWrapper>
  )
}

export default AuthorEditor
