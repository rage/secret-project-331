"use client"

import { css } from "@emotion/css"

import type { ColumnAttributes } from "@/../types/GutenbergBlockAttributes"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import type { BlockRendererProps } from "../.."
import InnerBlocks from "../../util/InnerBlocks"

const ALIGN_SELF: Record<string, string> = {
  top: "flex-start",
  center: "center",
  bottom: "flex-end",
}

/** One cell of a Columns block; its blocks render like top-level blocks but never break out of it. */
const ColumnBlock: React.FC<React.PropsWithChildren<BlockRendererProps<ColumnAttributes>>> = (
  props,
) => {
  const { verticalAlignment, width } = props.data.attributes
  const alignSelf = verticalAlignment ? ALIGN_SELF[verticalAlignment] : undefined

  return (
    <div
      className={css`
        ${alignSelf && `align-self: ${alignSelf};`}
        flex-grow: 1;
        min-width: min(100%, 10rem);

        ${respondToOrLarger.md} {
          ${width && `flex: 0 1 ${width};`}
        }

        /* Blocks like images and paragraphs keep their margin on an inner element. */
        > :first-child,
        > :first-child > :first-child {
          margin-top: 0;
        }
        > :last-child,
        > :last-child > :last-child {
          margin-bottom: 0;
        }
      `}
    >
      <InnerBlocks parentBlockProps={props} dontAllowInnerBlocksToBeWiderThanParentBlock />
    </div>
  )
}

export default withErrorBoundary(ColumnBlock)
