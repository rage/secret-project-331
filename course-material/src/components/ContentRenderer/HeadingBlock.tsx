import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import H1 from "./Headings/H1"
import H2 from "./Headings/H2"
import H3 from "./Headings/H3"

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



/* const HeadingBlock: React.FC<BlockRendererProps<HeadingBlockAttributes>> = ({ data }) => {
  onst attributes: HeadingBlockAttributes = data.attributesc
  return (
    {
      switch (attributes.level) {
        case 1:
          <H1>{attributes.content}</H1>
          break;
        case 2:
          <H2>{attributes.content}</H2>
          break;
        case 3:
          <H3>{attributes.content}</H3>
          break;
      }   
    }
  )
}

export default HeadingBlock */
