import { ColumnAttributes } from "../../types/GutenbergBlockAttributes"

import DefaultBlock from "./DefaultBlock"

import { BlockRendererProps, blockToRendererMap } from "."

const ColumnBlock: React.FC<BlockRendererProps<ColumnAttributes>> = ({ data }) => {
  return (
    <div>
      {data.innerBlocks.map((block) => {
        const Component = blockToRendererMap[block.name] ?? DefaultBlock
        return <Component key={block.clientId} data={block} />
      })}
    </div>
  )
}

export default ColumnBlock
