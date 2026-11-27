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

/** Percentage width of a column, or null when it is unset or in another unit. */
export const columnWidthPercent = (width: string | null | undefined): number | null =>
  width?.trim().endsWith("%") ? Number(width.trim().slice(0, -1)) : null

interface ColumnBlockProps extends BlockRendererProps<ColumnAttributes> {
  /** Share of the row for a column without its own width, in the same units as percentage widths. */
  unsetWidthShare?: number | undefined
  /** Authors wrap full-width sections in a one-column block, so those may still break out of it. */
  isOnlyColumn?: boolean | undefined
  /** Below the medium breakpoint, takes the full row instead of sharing it. */
  isStackedOnMobile?: boolean | undefined
}

/** One cell of a Columns block; its blocks render like top-level blocks but break out of it only when it is the only column. */
const ColumnBlock: React.FC<React.PropsWithChildren<ColumnBlockProps>> = (props) => {
  const { verticalAlignment, width } = props.data.attributes
  const alignSelf = verticalAlignment ? ALIGN_SELF[verticalAlignment] : undefined
  const percent = columnWidthPercent(width)
  // Percentages become proportional shares of the space left after the gaps, so 33% + 67% still fit on one row.
  const flex =
    percent !== null
      ? `${percent} 1 0`
      : width
        ? `0 1 ${width}`
        : `${props.unsetWidthShare ?? 1} 1 0`

  return (
    <div
      className={css`
        ${alignSelf && `align-self: ${alignSelf};`}
        flex-grow: 1;
        min-width: min(100%, 10rem);
        ${props.isStackedOnMobile && `flex-basis: 100%;`}

        ${respondToOrLarger.md} {
          flex: ${flex};
        }
      `}
    >
      <InnerBlocks
        parentBlockProps={props}
        dontAllowInnerBlocksToBeWiderThanParentBlock={!props.isOnlyColumn}
      />
    </div>
  )
}

export default withErrorBoundary(ColumnBlock)
