"use client"

import { css } from "@emotion/css"
import React from "react"

import { BlockRendererProps } from "../.."

import FlipButton from "./FlipButton"

import InnerBlocks from "@/components/course-material/ContentRenderer/util/InnerBlocks"
import { Block } from "@/services/course-material/backend"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface FlipCardAttributes {
  href: string
  alt: string
  height: string
  width: string
  backgroundColor: string
}

function isBlockImage(block: Block<unknown>): block is Block<FlipCardAttributes> {
  if (block.innerBlocks.length > 0) {
    return block.innerBlocks[0].name === "core/image"
  }
  return false
}

const InnerCardBlock: React.FC<React.PropsWithChildren<BlockRendererProps<FlipCardAttributes>>> = (
  props,
) => {
  // Checks if the inner card block is an image to render it correctly
  if (isBlockImage(props.data) && props.data.innerBlocks.length == 1) {
    const imageBlock = props.data.innerBlocks[0] as Block<FlipCardAttributes>
    const imageLink = imageBlock.attributes.href
    const altText = imageBlock.attributes.alt
    return (
      <div
        className={css`
          display: flex;
          flex-direction: column;
          margin: 0 !important;
        `}
      >
        <img
          src={imageLink}
          alt={altText}
          width={imageBlock.attributes.width}
          height={imageBlock.attributes.height}
        />
      </div>
    )
  } else {
    return (
      <div
        className={css`
          position: relative;
          display: flex;
          flex-direction: column;
          padding-left: 1rem;
          padding-right: 1rem;
          margin-top: 1rem !important;
          justify-content: center;
          align-items: center;
          ul {
            padding-inline-start: 1rem !important;
          }
          h1,
          h2,
          h3,
          h4,
          h5 {
            margin-top: 0px;
          }
        `}
      >
        <InnerBlocks parentBlockProps={props} dontAllowInnerBlocksToBeWiderThanParentBlock />
      </div>
    )
  }
}

const exported = withErrorBoundary(InnerCardBlock)
// @ts-expect-error: Custom property
exported.dontUseDefaultBlockMargin = true

export default exported
