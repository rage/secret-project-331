import { css } from "@emotion/css"
import { InnerBlocks, RichText } from "@wordpress/block-editor"
import { BlockEditProps, Template } from "@wordpress/blocks"
import React from "react"

import Button from "../../shared-module/components/Button"
import BlockWrapper from "../BlockWrapper"

import { LandingPageHeroSectionAttributes } from "."

const ALLOWED_NESTED_BLOCKS = ["core/heading", "core/paragraph"]
const LANDING_PAGE_HERO_SECTION_TEMPLATE: Template[] = [
  ["core/paragraph", { placeholder: "Insert sales speech...", align: "center" }],
]

const LandingPageHeroSectionEditor: React.FC<BlockEditProps<LandingPageHeroSectionAttributes>> = ({
  clientId,
  attributes,
  setAttributes,
}) => {
  const { title } = attributes
  return (
    <BlockWrapper id={clientId}>
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
    </BlockWrapper>
  )
}

export default LandingPageHeroSectionEditor
