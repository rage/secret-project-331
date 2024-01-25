import { css } from "@emotion/css"
import { InnerBlocks, RichText } from "@wordpress/block-editor"
import { BlockEditProps, Template } from "@wordpress/blocks"
import React from "react"

import BreakFromCentered from "../../shared-module/common/components/Centering/BreakFromCentered"
import { baseTheme } from "../../shared-module/common/styles"
import {
  CMS_EDITOR_SIDEBAR_THRESHOLD,
  CMS_EDITOR_SIDEBAR_WIDTH,
} from "../../shared-module/common/utils/constants"
import BlockWrapper from "../BlockWrapper"

import { CourseObjectiveSectionAttributes } from "."

const ALLOWED_NESTED_BLOCKS = ["core/heading", "core/buttons", "core/button", "core/paragraph"]
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
            { placeholder: "Objective #1", level: 3, textAlign: "center", anchor: "objective-1" },
          ],
          ["core/paragraph", { placeholder: "Insert text...", align: "center" }],
        ],
      ],
      [
        "core/column",
        {},
        [
          [
            "core/heading",
            { placeholder: "Objective #2", level: 3, textAlign: "center", anchor: "objective-2" },
          ],
          ["core/paragraph", { placeholder: "Insert text...", align: "center" }],
        ],
      ],
      [
        "core/column",
        {},
        [
          [
            "core/heading",
            { placeholder: "Objective #3", level: 3, textAlign: "center", anchor: "objective-2" },
          ],
          ["core/paragraph", { placeholder: "Insert text...", align: "center" }],
        ],
      ],
    ],
  ],
]

const CourseObjectiveSectionEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<CourseObjectiveSectionAttributes>>
> = ({ clientId, attributes, setAttributes }) => {
  const { title } = attributes
  return (
    <BlockWrapper id={clientId}>
      <BreakFromCentered
        sidebar
        sidebarPosition="right"
        sidebarWidth={CMS_EDITOR_SIDEBAR_WIDTH}
        sidebarThreshold={CMS_EDITOR_SIDEBAR_THRESHOLD}
      >
        <div
          className={css`
            background: ${baseTheme.colors.clear[100]};
            width: 100%;
            border-radius: 1px;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            padding: 7.5em 1em;
          `}
        >
          <RichText
            className="has-text-align-center wp-block-heading"
            // eslint-disable-next-line i18next/no-literal-string
            tagName="h2"
            value={title}
            onChange={(value: string) => setAttributes({ title: value })}
            // eslint-disable-next-line i18next/no-literal-string
            placeholder={"In this course you'll..."}
          />
          <InnerBlocks
            template={COURSE_OBJECTIVE_SECTION_TEMPLATE}
            allowedBlocks={ALLOWED_NESTED_BLOCKS}
          />
        </div>
      </BreakFromCentered>
    </BlockWrapper>
  )
}

export default CourseObjectiveSectionEditor
