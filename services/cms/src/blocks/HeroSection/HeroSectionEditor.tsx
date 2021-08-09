import { css } from "@emotion/css"
import { InnerBlocks, RichText } from "@wordpress/block-editor"
import { BlockEditProps, Template } from "@wordpress/blocks"
import React from "react"

import Button from "../../shared-module/components/Button"
import BlockWrapper from "../BlockWrapper"

import { HeroSectionAttributes } from "."

const ALLOWED_NESTED_BLOCKS = ["core/heading", "core/paragraph"]
const HERO_SECTION_TEMPLATE: Template[] = [
  ["core/paragraph", { placeholder: "Insert sales speech...", align: "center" }],
]

const HeroSectionEditor: React.FC<BlockEditProps<HeroSectionAttributes>> = ({
  clientId,
  attributes,
  setAttributes,
}) => {
  const { heroHeading } = attributes
  return (
    <BlockWrapper id={clientId}>
      <RichText
        className="has-text-align-center wp-block-heading"
        tagName="h1"
        value={heroHeading}
        onChange={(value: string) => setAttributes({ heroHeading: value })}
        placeholder={"Welcome message for course..."}
      />
      <InnerBlocks template={HERO_SECTION_TEMPLATE} allowedBlocks={ALLOWED_NESTED_BLOCKS} />
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

export default HeroSectionEditor
