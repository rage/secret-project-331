"use client"

import { css } from "@emotion/css"
import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"

import { headingFont } from "@/shared-module/common/styles"
import { registeredInnerBlocksProps } from "@/utils/Gutenberg/registeredInnerBlocksProps"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import BlockWrapper from "../BlockWrapper"

const LandingPageCopyTextEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, unknown>>>
> = ({ name }) => {
  const { t } = useTranslation()
  return (
    <BlockWrapper>
      <div>
        <div
          className={css`
            padding: 1rem;
            background: #ecf3f2;
            text-align: center;
            font-family: ${headingFont};
          `}
        >
          <h2
            className={css`
              font-size: 1rem;
            `}
          >
            {t("landing-page-copy-text")}
          </h2>
        </div>
        <InnerBlocks {...registeredInnerBlocksProps(name)} />
      </div>
    </BlockWrapper>
  )
}

export default LandingPageCopyTextEditor
