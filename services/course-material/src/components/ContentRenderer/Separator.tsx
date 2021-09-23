import React from "react"

import { SeparatorAttributes } from "../../types/GutenbergBlockAttributes"

import { BlockRendererProps } from "."

const SeparatorBlock: React.FC<BlockRendererProps<SeparatorAttributes>> = () => {
  return <hr />
}

export default SeparatorBlock
