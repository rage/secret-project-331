import { css } from "@emotion/css"

import { BlockRendererProps, blockToRendererMap } from "../.."
import { ColumnAttributes } from "../../../../../types/GutenbergBlockAttributes"
import DefaultBlock from "../../DefaultBlock"

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
    if (verticalAlignment === "bottom") {
      return "align-self: flex-end;"
    } else if (verticalAlignment === "center") {
      return "align-self: center;"
    } else if (verticalAlignment === "top") {
      return "align-celf: flex-start;"
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
