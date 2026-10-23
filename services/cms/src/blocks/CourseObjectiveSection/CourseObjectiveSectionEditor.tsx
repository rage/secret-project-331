"use client"

import { css } from "@emotion/css"
import { InnerBlocks, RichText } from "@wordpress/block-editor"
import React from "react"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { baseTheme } from "@/shared-module/common/styles"
import {
  CMS_EDITOR_SIDEBAR_THRESHOLD,
  CMS_EDITOR_SIDEBAR_WIDTH,
} from "@/shared-module/common/utils/constants"
import { registeredInnerBlocksProps } from "@/utils/Gutenberg/registeredInnerBlocksProps"
import type { BlockEditProps } from "@/utils/Gutenberg/types"

import type { CourseObjectiveSectionAttributes } from "."
import BlockWrapper from "../BlockWrapper"

const CourseObjectiveSectionEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<CourseObjectiveSectionAttributes>>
> = ({ name, attributes, setAttributes }) => {
  const { title } = attributes
  return (
    <BlockWrapper>
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
            tagName="h2"
            value={title}
            onChange={(value: string) => setAttributes({ title: value })}
            placeholder={
              // oxlint-disable-next-line i18next/no-literal-string
              "In this course you'll..."
            }
          />
          <InnerBlocks {...registeredInnerBlocksProps(name)} />
        </div>
      </BreakFromCentered>
    </BlockWrapper>
  )
}

export default CourseObjectiveSectionEditor
