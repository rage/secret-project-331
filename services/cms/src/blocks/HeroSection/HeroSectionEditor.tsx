import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps, Template } from "@wordpress/blocks"
import React from "react"

import BlockWrapper from "../BlockWrapper"

const ALLOWED_NESTED_BLOCKS = ["core/heading", "core/paragraph"]
const HERO_SECTION_TEMPLATE: Template[] = [
  ["core/heading", { placeholder: "Chapter heading...", textAlign: "center", level: 2 }],
  ["core/heading", { placeholder: "Chapter subheading...", textAlign: "center", level: 3 }],
]

const HeroSectionEditor: React.FC<BlockEditProps<Record<string, never>>> = ({ clientId }) => {
  return (
    <BlockWrapper id={clientId}>
      <InnerBlocks template={HERO_SECTION_TEMPLATE} allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </BlockWrapper>
  )
}

export default HeroSectionEditor
