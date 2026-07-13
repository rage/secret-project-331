"use client"

import { css } from "@emotion/css"

import type { BlockRendererProps } from "../.."
import { blockToRendererMap } from "../.."

import type { ColumnAttributes } from "@/../types/GutenbergBlockAttributes"
import DefaultBlock from "@/components/course-material/ContentRenderer/DefaultBlock"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const ColumnBlock: React.FC<React.PropsWithChildren<BlockRendererProps<ColumnAttributes>>> = ({
  data,
}) => {
  const {
    // className,
    // style,
    // templateLock,
    verticalAlignment,
    width,
  } = data.attributes

  const getAlignSelf = (verticalAlignment: string) => {
    const ALIGN_SELF_FLEX_END = "align-self: flex-end;"
    const ALIGN_SELF_CENTER = "align-self: center;"
    const ALIGN_SELF_FLEX_START = "align-celf: flex-start;"
    if (verticalAlignment === "bottom") {
      return ALIGN_SELF_FLEX_END
    } else if (verticalAlignment === "center") {
      return ALIGN_SELF_CENTER
    } else if (verticalAlignment === "top") {
      return ALIGN_SELF_FLEX_START
    }
  }

  return (
    <div
      className={css`
        ${verticalAlignment && getAlignSelf(verticalAlignment)}
        overflow-wrap: break-word;
        flex-grow: 1;
        ${respondToOrLarger.md} {
          ${width && `max-width: ${width};`}
          flex-basis: 0;
        }
        /* Ensure padding 0 in child elements */
        > * {
          padding: 0rem;
        }
      `}
    >
      {data.innerBlocks.map((block) => {
        const Component = blockToRendererMap[block.name] ?? DefaultBlock
        return <Component key={block.clientId} data={block} />
      })}
    </div>
  )
}

export default withErrorBoundary(ColumnBlock)
