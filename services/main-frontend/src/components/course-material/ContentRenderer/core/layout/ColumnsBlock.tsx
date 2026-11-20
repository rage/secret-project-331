"use client"

import { css } from "@emotion/css"

import type { ColumnAttributes, ColumnsAttributes } from "@/../types/GutenbergBlockAttributes"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import type { Block } from "@/types/courseMaterialBlock"

import type { BlockRendererProps } from "../.."
import ColumnBlock from "./ColumnBlock"

const ColumnsBlock: React.FC<React.PropsWithChildren<BlockRendererProps<ColumnsAttributes>>> = (
  props,
) => {
  const innerBlocks = props.data.innerBlocks as Block<ColumnAttributes>[]
  const { isStackedOnMobile, verticalAlignment } = props.data.attributes

  return (
    <div
      className={css`
        display: flex;
        flex-wrap: wrap;
        gap: 1.5rem 2rem;
        ${verticalAlignment && `align-items: ${verticalAlignment};`}

        ${
          isStackedOnMobile !== false &&
          `> * {
          flex-basis: 100%;
        }`
        }

        ${respondToOrLarger.md} {
          > * {
            flex-basis: 0;
          }
        }
      `}
    >
      {innerBlocks.map((block) => (
        <ColumnBlock key={block.clientId} data={block} id={block.clientId} isExam={props.isExam} />
      ))}
    </div>
  )
}

export default withErrorBoundary(ColumnsBlock)
