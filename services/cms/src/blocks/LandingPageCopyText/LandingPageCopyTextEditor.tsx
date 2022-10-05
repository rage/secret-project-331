import { css } from "@emotion/css"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme, headingFont } from "../../shared-module/styles"
import BlockWrapper from "../BlockWrapper"

const ALLOWED_NESTED_BLOCKS = [
  "core/table",
  "core/paragraph",
  "core/heading",
  "core/list",
  "core/quote",
]

const LandingPageCopyTextEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, unknown>>>
> = ({ clientId }) => {
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
          <h4>{t("landing-page-copy-text")}</h4>
        </div>
        <InnerBlocks 
          allowedBlocks={ALLOWED_NESTED_BLOCKS}
          // eslint-disable-next-line i18next/no-literal-string
          templateLock="all"
        />
      </div>
    </BlockWrapper>
  )
}

export default LandingPageCopyTextEditor
