import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"

interface HeadingBlockAttributes {
  level: string
  content: string
}

const HeadingBlock: React.FC<BlockRendererProps<HeadingBlockAttributes>> = ({ data }) => {
  const attributes: HeadingBlockAttributes = data.attributes
  return (
    <h1
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
    {attributes.content}
    </h1>
  )
}

export default HeadingBlock
