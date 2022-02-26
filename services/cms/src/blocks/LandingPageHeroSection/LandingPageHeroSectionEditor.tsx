/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { InnerBlocks, RichText } from "@wordpress/block-editor"
import { BlockEditProps, Template } from "@wordpress/blocks"
import React from "react"

import Button from "../../shared-module/components/Button"
import BreakFromCentered from "../../shared-module/components/Centering/BreakFromCentered"
import { baseTheme } from "../../shared-module/styles"
import breakFromCenteredProps from "../../utils/breakfromCenteredProps"
import BlockWrapper from "../BlockWrapper"

import { LandingPageHeroSectionAttributes } from "."

const ALLOWED_NESTED_BLOCKS = ["core/heading", "core/paragraph"]
const LANDING_PAGE_HERO_SECTION_TEMPLATE: Template[] = [
  [
    "core/paragraph",
    { content: "Insert sales speech...", placeholder: "Insert sales speech...", align: "center" },
  ],
]

const LandingPageHeroSectionEditor: React.FC<BlockEditProps<LandingPageHeroSectionAttributes>> = ({
  clientId,
  attributes,
  setAttributes,
}) => {
  const { title } = attributes
  return (
    <BlockWrapper id={clientId}>
      <BreakFromCentered {...breakFromCenteredProps}>
        <div
          className={css`
            background: ${baseTheme.colors.blue[100]};
            width: 100%;
            border-radius: 1px;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            padding: 7.5em 1em;
          `}
        >
          <RichText
            className="has-text-align-center wp-block-heading"
            tagName="h1"
            value={title}
            onChange={(value: string) => setAttributes({ title: value })}
            placeholder={"Welcome message for course..."}
          />
          <InnerBlocks
            template={LANDING_PAGE_HERO_SECTION_TEMPLATE}
            allowedBlocks={ALLOWED_NESTED_BLOCKS}
          />
          <div
            className={css`
              display: flex;
              justify-content: center;
              align-items: center;
            `}
          >
            <Button variant="primary" size="large">
              Start
            </Button>
          </div>
        </div>
      </BreakFromCentered>
    </BlockWrapper>
  )
}

export default LandingPageHeroSectionEditor
