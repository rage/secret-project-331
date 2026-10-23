"use client"

import { css } from "@emotion/css"
import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"

import { registeredInnerBlocksProps } from "@/utils/Gutenberg/registeredInnerBlocksProps"
import type { BlockEditProps } from "@/utils/Gutenberg/types"

import BlockWrapper from "../BlockWrapper"

const LogoLinkEditor: React.FC<React.PropsWithChildren<BlockEditProps<Record<string, never>>>> = ({
  name,
}) => {
  return (
    <BlockWrapper>
      <div
        className={css`
          background: #fafbfb;
          width: 100%;
        `}
      >
        <div>
          <InnerBlocks {...registeredInnerBlocksProps(name)} />
        </div>
      </div>
    </BlockWrapper>
  )
}

export default LogoLinkEditor
