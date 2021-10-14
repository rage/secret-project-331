import React from "react"

import { BlockRendererProps } from "../.."
import { SeparatorAttributes } from "../../../../types/GutenbergBlockAttributes"

const SeparatorBlock: React.FC<BlockRendererProps<SeparatorAttributes>> = () => {
  return <hr />
}

export default SeparatorBlock
