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
      [
        "core/column",
        {},
        [
          [
            "core/image",
            {
              level: 2,
              textAlign: "left",
              anchor: "author-photo",
            },
          ],
        ],
      ],
      [
        "core/column",
        {},
        [
          [
            "core/paragraph",
            {
              content: "Insert author's bio text...",
              placeholder: "Insert author's bio text...",
              align: "left",
            },
          ],
        ],
      ],
    ],
  ],
]

const AuthorEditor: React.FC<
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
        <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} template={AUTHOR_BLOCK_TEMPLATE} />
      </div>
    </BlockWrapper>
  )
}

export default AuthorEditor
