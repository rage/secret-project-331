"use client"

import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"

import BlockWrapper from "../BlockWrapper"

import type { BlockEditProps, Template } from "@/utils/Gutenberg/types"

const ALLOWED_NESTED_BLOCKS = ["core/image", "core/paragraph"]
const AUTHOR_BLOCK_TEMPLATE: Template[] = [
  [
    "core/columns",
    { isStackedOnMobile: true },
    [
      ["core/column", {}, [["core/image", {}]]],
      [
        "core/column",
        {},
        [["core/paragraph", { placeholder: "Insert author's bio text...", align: "left" }]],
      ],
    ],
  ],
]

const AuthorInnerBlockEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, never>>>
> = ({ clientId }) => {
  return (
    <BlockWrapper id={clientId}>
      <div>
        <InnerBlocks
          allowedBlocks={ALLOWED_NESTED_BLOCKS}
          template={AUTHOR_BLOCK_TEMPLATE}
          templateLock="all"
        />
      </div>
    </BlockWrapper>
  )
}

export default AuthorInnerBlockEditor
