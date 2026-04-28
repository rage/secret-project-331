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

const AuthorEditor: React.FC<React.PropsWithChildren<BlockEditProps<Record<string, never>>>> = ({
  clientId,
}) => {
  return (
    <BlockWrapper id={clientId}>
      <div>
        <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} template={AUTHOR_BLOCK_TEMPLATE} />
      </div>
    </BlockWrapper>
  )
}

export default AuthorEditor
