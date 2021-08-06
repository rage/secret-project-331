import { InnerBlocks, RichText } from "@wordpress/block-editor"
import { BlockEditProps, Template } from "@wordpress/blocks"
import React from "react"

import BlockWrapper from "../BlockWrapper"

import { HeroSectionAttributes } from "."

const ALLOWED_NESTED_BLOCKS = ["core/heading", "core/buttons", "core/paragraph"]
const HERO_SECTION_TEMPLATE: Template[] = [
  ["core/paragraph", { placeholder: "Insert short sales speech...", align: "center" }],
  [
    "core/buttons",
    { orientation: "vertical", contentJustification: "center" },
    [
      [
        "core/button",
        { text: "Start", className: "is-style-outline", url: "/start", rel: "/start" },
      ],
    ],
  ],
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
    </BlockWrapper>
  )
}

export default HeroSectionEditor
