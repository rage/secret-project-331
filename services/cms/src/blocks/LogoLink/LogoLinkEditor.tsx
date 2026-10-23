"use client"

import { css } from "@emotion/css"
import React from "react"

import RegisteredInnerBlocks from "@/utils/Gutenberg/RegisteredInnerBlocks"
import type { BlockEditProps } from "@/utils/Gutenberg/types"

import BlockWrapper from "../BlockWrapper"

const LogoLinkEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, never>>>
> = () => {
  return (
    <BlockWrapper>
      <div
        className={css`
          background: #fafbfb;
          width: 100%;
        `}
      >
        <div>
          <RegisteredInnerBlocks />
        </div>
      </div>
    </BlockWrapper>
  )
}

export default LogoLinkEditor
