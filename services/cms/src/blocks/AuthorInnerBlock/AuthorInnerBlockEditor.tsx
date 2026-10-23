"use client"

import { css } from "@emotion/css"
import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"

import type { BlockEditProps, Template } from "@/utils/Gutenberg/types"

import BlockWrapper from "../BlockWrapper"

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
        <InnerBlocks template={AUTHOR_BLOCK_TEMPLATE} templateLock="insert" />
      </div>
    </BlockWrapper>
  )
}

export default AuthorInnerBlockEditor
