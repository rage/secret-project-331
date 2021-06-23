import { BlockRendererProps } from "."
import { HeadingAttributes } from "../../types/GutenbergBlockAttributes"

import H1 from "./Headings/H1"
import H2 from "./Headings/H2"
import H3 from "./Headings/H3"


const HeadingBlock: React.FC<BlockRendererProps<HeadingAttributes>> = ({ data }) => {
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
