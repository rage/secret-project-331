import { ColumnsAttributes } from "../../types/GutenbergBlockAttributes"

import DefaultBlock from "./DefaultBlock"

import { BlockRendererProps, blockToRendererMap } from "."

const ColumnsBlock: React.FC<BlockRendererProps<ColumnsAttributes>> = ({ data }) => {
  return (
    <div>
      {data.innerBlocks.map((block) => {
        const Component = blockToRendererMap[block.name] ?? DefaultBlock
        return <Component key={block.clientId} data={block} />
      })}
    </div>
  )
}

export default ColumnsBlock
