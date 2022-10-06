import { css } from "@emotion/css"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps, Template } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import { headingFont } from "../../shared-module/styles"
import BlockWrapper from "../BlockWrapper"

const ALLOWED_NESTED_BLOCKS = [
  "core/table",
  "core/paragraph",
  "core/heading",
  "core/list",
  "core/quote",
]

const LANDING_PAGE_COPY_TEXT_TEMPLATE: Template[] = [
  [
    "core/columns",
    { isStackedOnMobile: true },
    [
      [
        "core/column",
        {},
        [
          [
            "core/heading",
            {
              placeholder: "About this course",
              level: 3,
              textAlign: "left",
              anchor: "about-this-course",
            },
          ],
          ["core/paragraph", { placeholder: "Insert text...", align: "left" }],
        ],
      ],
    ],
  ],
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
          template={LANDING_PAGE_COPY_TEXT_TEMPLATE}
        />
      </div>
    </BlockWrapper>
  )
}

export default LandingPageCopyTextEditor
