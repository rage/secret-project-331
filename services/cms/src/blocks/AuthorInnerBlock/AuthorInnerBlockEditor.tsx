"use client"

import { css } from "@emotion/css"
import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"

import type { BlockEditProps, Template } from "@/utils/Gutenberg/types"

import BlockWrapper from "../BlockWrapper"

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
> = () => {
  return (
    <BlockWrapper>
      <div
        className={css`
          .wp-block-columns {
            gap: var(--space-5);
          }
        `}
      >
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
