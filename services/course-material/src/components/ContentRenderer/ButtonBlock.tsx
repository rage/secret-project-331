import { css } from "@emotion/css"

import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"

import { BlockRendererProps } from "."

interface HeadingBlockAttributes {
  level: string
  content: string
}
interface HeadingBlockInnerBlock {
  text: string
}

const HeadingBlock: React.FC<BlockRendererProps<HeadingBlockAttributes>> = ({ data }) => {
  const innerBlocks: HeadingBlockInnerBlock = data.innerBlocks[0].attributes
  return (
    <button
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      {innerBlocks.text}
    </button>
  )
}

export default HeadingBlock
