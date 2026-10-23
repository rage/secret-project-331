"use client"

import { css } from "@emotion/css"
import React from "react"

import RegisteredInnerBlocks from "@/utils/Gutenberg/RegisteredInnerBlocks"
import type { BlockEditProps } from "@/utils/Gutenberg/types"

import BlockWrapper from "../BlockWrapper"

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
        <RegisteredInnerBlocks />
      </div>
    </BlockWrapper>
  )
}

export default AuthorInnerBlockEditor
