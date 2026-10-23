"use client"

import { css } from "@emotion/css"
import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"

import { baseTheme, headingFont } from "@/shared-module/common/styles"
import { registeredInnerBlocksProps } from "@/utils/Gutenberg/registeredInnerBlocksProps"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import BlockWrapper from "../BlockWrapper"

const PartnerEditor: React.FC<React.PropsWithChildren<BlockEditProps<Record<string, never>>>> = ({
  name,
}) => {
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
          <h4>{t("partners-block")}</h4>
          <span
            className={css`
              color: ${baseTheme.colors.green[600]};
              text-align: center;
              font-weight: 600;
              font-family: ${headingFont};
            `}
          >
            {t("partners-block-description")}
          </span>
        </div>
        <div>
          <InnerBlocks {...registeredInnerBlocksProps(name)} />
        </div>
      </div>
    </BlockWrapper>
  )
}

export default PartnerEditor
