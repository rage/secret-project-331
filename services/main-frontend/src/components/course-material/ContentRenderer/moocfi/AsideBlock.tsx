"use client"

import { css } from "@emotion/css"
import React from "react"

import { BlockRendererProps } from ".."
import InnerBlocks from "../util/InnerBlocks"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

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
        padding: 0rem 0.8rem;
        border-top: 0.4rem solid ${props.data.attributes.separatorColor};
        border-bottom: 0.4rem solid ${props.data.attributes.separatorColor};
        background: ${props.data.attributes.backgroundColor};

        ${respondToOrLarger.md} {
          padding: 1rem 2rem;
        }

        h1,
        h2,
        h3,
        h4,
        h5,
        h6 {
          margin-top: 0;
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
