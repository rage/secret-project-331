import { BlockRendererProps } from "."

import H1 from "./Headings/H1"
import H2 from "./Headings/H2"
import H3 from "./Headings/H3"

interface HeadingBlockAttributes {
  level: number
  content: string
  textColor: string
}

const HeadingBlock: React.FC<BlockRendererProps<HeadingBlockAttributes>> = ({ data }) => {
  const attributes = data.attributes
  switch (attributes.level) {
    case 1:
      return <H1>{attributes.content}</H1>
    case 2:
      return <H2>{attributes.content}</H2>
    case 3:
      return <H3>{attributes.content}</H3>
    default:
      return <H1>{attributes.content}</H1>
  }
}

export default HeadingBlock
