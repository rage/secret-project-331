import { css } from "@emotion/css"
import { InnerBlocks, RichText } from "@wordpress/block-editor"
import { BlockEditProps, Template } from "@wordpress/blocks"
import React from "react"

import BreakFromCentered from "../../shared-module/components/Centering/BreakFromCentered"
import { baseTheme } from "../../shared-module/styles"
import {
  CMS_EDITOR_SIDEBAR_THRESHOLD,
  CMS_EDITOR_SIDEBAR_WIDTH,
} from "../../shared-module/utils/constants"
import BlockWrapper from "../BlockWrapper"

import { LearningObjectiveSectionAttributes } from "."

const ALLOWED_NESTED_BLOCKS = [
  "core/heading",
  "core/buttons",
  "core/button",
  "core/paragraph",
  "core/list",
]
const LEARNING_OBJECTIVE_SECTION_TEMPLATE: Template[] = [
  [
    "core/columns",
    { isStackedOnMobile: true },
    [
      ["core/column", {}, [["core/list", { placeholder: "Insert text...", align: "left" }]]],
      ["core/column", {}, [["core/list", { placeholder: "Insert text...", align: "left" }]]],
    ],
  ],
]

const LearningObjectiveSectionEditor: React.FC<
  BlockEditProps<LearningObjectiveSectionAttributes>
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
            placeholder={"What you will learn in this chapter..."}
          />
          <InnerBlocks
            template={LEARNING_OBJECTIVE_SECTION_TEMPLATE}
            allowedBlocks={ALLOWED_NESTED_BLOCKS}
          />
        </div>
      </BreakFromCentered>
    </BlockWrapper>
  )
}

export default LearningObjectiveSectionEditor
