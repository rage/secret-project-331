import { css } from "@emotion/css"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps, Template } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme, headingFont } from "../../shared-module/styles"
import BlockWrapper from "../BlockWrapper"

const ALLOWED_NESTED_BLOCKS = ["moocfi/author-inner-block"]
const AUTHOR_BLOCK_TEMPLATE: Template[] = [["moocfi/author-inner-block"]]
const AuthorEditor: React.FC<React.PropsWithChildren<BlockEditProps<Record<string, never>>>> = ({
  clientId,
}) => {
  const { t } = useTranslation()
  return (
    <BlockWrapper id={clientId}>
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
            <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} template={AUTHOR_BLOCK_TEMPLATE} />
          </div>
        </div>
      </div>
    </BlockWrapper>
  )
}

export default AuthorEditor
