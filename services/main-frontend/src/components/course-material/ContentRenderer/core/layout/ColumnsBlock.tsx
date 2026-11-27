"use client"

import { css } from "@emotion/css"

import type { ColumnAttributes, ColumnsAttributes } from "@/../types/GutenbergBlockAttributes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import type { Block } from "@/types/courseMaterialBlock"

import type { BlockRendererProps } from "../.."
import ColumnBlock, { columnWidthPercent } from "./ColumnBlock"

const ColumnsBlock: React.FC<React.PropsWithChildren<BlockRendererProps<ColumnsAttributes>>> = (
  props,
) => {
  const innerBlocks = props.data.innerBlocks as Block<ColumnAttributes>[]
  const { isStackedOnMobile, verticalAlignment } = props.data.attributes
  const percents = innerBlocks.map((block) => columnWidthPercent(block.attributes.width))
  const percentTotal = percents.reduce<number>((total, percent) => total + (percent ?? 0), 0)
  const unsetCount = innerBlocks.filter((block) => !block.attributes.width).length
  // Columns without a width split what the others leave, as in the editor.
  const unsetWidthShare =
    percentTotal > 0 && unsetCount > 0 ? Math.max(100 - percentTotal, 0) / unsetCount : undefined

  return (
    <div
      className={css`
        display: flex;
        flex-wrap: wrap;
        gap: 1.5rem 2rem;
        ${verticalAlignment && `align-items: ${verticalAlignment};`}
      `}
    >
      {innerBlocks.map((block) => (
        <ColumnBlock
          key={block.clientId}
          data={block}
          id={block.clientId}
          isExam={props.isExam}
          unsetWidthShare={unsetWidthShare}
          isOnlyColumn={innerBlocks.length === 1}
          isStackedOnMobile={isStackedOnMobile !== false}
        />
      ))}
    </div>
  )
}

export default withErrorBoundary(ColumnsBlock)
