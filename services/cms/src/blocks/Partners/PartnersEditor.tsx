import { css } from "@emotion/css"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import BlockWrapper from "../BlockWrapper"

import { baseTheme, headingFont } from "@/shared-module/common/styles"

const ALLOWED_NESTED_BLOCKS = ["core/image"]

const PartnerEditor: React.FC<React.PropsWithChildren<BlockEditProps<Record<string, never>>>> = ({
  clientId,
}) => {
  const { t } = useTranslation()
  return (
    <BlockWrapper id={clientId}>
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
          <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
        </div>
      </div>
    </BlockWrapper>
  )
}

export default PartnerEditor
