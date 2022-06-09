import { css } from "@emotion/css"
import { InnerBlocks } from "@wordpress/block-editor"
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

const ALLOWED_NESTED_BLOCKS = ["core/list"]
const LEARNING_OBJECTIVE_SECTION_TEMPLATE: Template[] = [
  ["core/list", { placeholder: "Insert text...", align: "left" }],
]

const LearningObjectiveSectionEditor: React.FC<
  BlockEditProps<LearningObjectiveSectionAttributes>
> = ({ clientId }) => {
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
