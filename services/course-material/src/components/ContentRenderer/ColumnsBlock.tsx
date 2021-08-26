import { css } from "@emotion/css"

import { respond } from "../../shared-module/styles/respond"
import { ColumnsAttributes } from "../../types/GutenbergBlockAttributes"

import DefaultBlock from "./DefaultBlock"

import { BlockRendererProps, blockToRendererMap } from "."

const ColumnsBlock: React.FC<BlockRendererProps<ColumnsAttributes>> = ({ data }) => {
  return (
    <div
      className={css`
        display: flex;
        ${respond.mobile`
          flex-wrap: wrap;
        `}
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
