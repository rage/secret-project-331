"use client"

import { css } from "@emotion/css"
import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"

import { registeredInnerBlocksProps } from "@/utils/Gutenberg/registeredInnerBlocksProps"
import type { BlockEditProps } from "@/utils/Gutenberg/types"

import BlockWrapper from "../BlockWrapper"

const AuthorInnerBlockEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, never>>>
> = ({ name }) => {
  return (
    <BlockWrapper>
      <div
        className={css`
          .wp-block-columns {
            gap: var(--space-5);
          }
        `}
      >
        <InnerBlocks {...registeredInnerBlocksProps(name)} />
      </div>
    </BlockWrapper>
  )
}

export default AuthorInnerBlockEditor
