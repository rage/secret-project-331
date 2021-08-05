import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps, Template } from "@wordpress/blocks"
import React from "react"

import BlockWrapper from "../BlockWrapper"

const ALLOWED_NESTED_BLOCKS = ["core/heading", "core/buttons", "core/paragraph"]
const HERO_SECTION_TEMPLATE: Template[] = [
  ["core/heading", { placeholder: "Welcome to...", level: 1, textAlign: "center" }],
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

const HeroSectionEditor: React.FC<BlockEditProps<Record<string, never>>> = ({ clientId }) => {
  return (
    <BlockWrapper id={clientId}>
      <InnerBlocks template={HERO_SECTION_TEMPLATE} allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </BlockWrapper>
  )
}

export default HeroSectionEditor
