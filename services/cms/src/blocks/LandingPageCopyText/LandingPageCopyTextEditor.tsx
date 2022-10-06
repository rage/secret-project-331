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

const COURSE_OBJECTIVE_SECTION_TEMPLATE: Template[] = [
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
              anchor: "objective-1",
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
          template={COURSE_OBJECTIVE_SECTION_TEMPLATE}
        />
      </div>
    </BlockWrapper>
  )
}

export default LandingPageCopyTextEditor
