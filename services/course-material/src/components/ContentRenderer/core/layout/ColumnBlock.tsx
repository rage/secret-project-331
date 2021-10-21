import { css } from "@emotion/css"

import { BlockRendererProps, blockToRendererMap } from "../.."
import { respondToOrLarger } from "../../../../shared-module/styles/respond"
import colorMapper from "../../../../styles/colorMapper"
import { ColumnAttributes } from "../../../../types/GutenbergBlockAttributes"
import DefaultBlock from "../../DefaultBlock"

const ColumnBlock: React.FC<BlockRendererProps<ColumnAttributes>> = ({ data }) => {
  const {
    anchor,
    backgroundColor,
    // className,
    gradient,
    // style,
    // templateLock,
    textColor,
    verticalAlignment,
    width,
  } = data.attributes
  return (
    <div
      className={css`
        ${backgroundColor && `background: ${colorMapper(backgroundColor)};`}
        ${gradient && `background: ${colorMapper(gradient)};`}
        ${textColor && `color: ${colorMapper(textColor)};`}
        ${verticalAlignment && `align-self: ${verticalAlignment};`}
        word-break: break-word;
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
      {...(anchor && { id: anchor })}
    >
      {data.innerBlocks.map((block) => {
        const Component = blockToRendererMap[block.name] ?? DefaultBlock
        return <Component key={block.clientId} data={block} />
      })}
    </div>
  )
}

export default ColumnBlock
