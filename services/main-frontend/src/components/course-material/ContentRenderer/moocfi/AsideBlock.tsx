"use client"

import { css } from "@emotion/css"
import React from "react"

import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import type { BlockRendererProps } from ".."
import InnerBlocks from "../util/InnerBlocks"

interface AsideBlockProps {
  backgroundColor: string
  separatorColor: string
}

const AsideBLock: React.FC<React.PropsWithChildren<BlockRendererProps<AsideBlockProps>>> = (
  props,
) => {
  return (
    <div
      className={css`
        /* A plain aside is a bar beside the text; the author's background colour is not used. */
        padding: 0.25rem 0 0.25rem 1.25rem;
        border-left: 4px solid
          ${props.data.attributes.separatorColor || baseTheme.colors.green[600]};

        ${respondToOrLarger.md} {
          padding-left: 1.5rem;
        }

        /* Contain floated children (e.g. left-floated images) so they don't overflow past
        the bottom border when the adjacent text is short. */
        &::after {
          content: "";
          display: block;
          clear: both;
        }
      `}
    >
      <InnerBlocks parentBlockProps={props} dontAllowInnerBlocksToBeWiderThanParentBlock />
    </div>
  )
}

export default withErrorBoundary(AsideBLock)
