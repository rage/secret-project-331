import { css } from "@emotion/css"

import { BlockRendererProps, blockToRendererMap } from "../.."
import { respondToOrLarger } from "../../../../shared-module/styles/respond"
import { ColumnsAttributes } from "../../../../types/GutenbergBlockAttributes"
import DefaultBlock from "../../DefaultBlock"

const ColumnsBlock: React.FC<BlockRendererProps<ColumnsAttributes>> = ({ data }) => {
  return (
    <div
      className={css`
        display: flex;
        flex-wrap: wrap;
        ${respondToOrLarger.lg} {
          flex-wrap: nowrap;
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

export default ColumnsBlock
