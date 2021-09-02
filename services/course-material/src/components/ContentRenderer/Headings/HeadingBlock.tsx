import { BlockRendererProps } from ".."
import { HeadingAttributes } from "../../../types/GutenbergBlockAttributes"

import { H1, H2, H3, H4, H5, H6 } from "."

const HeadingBlock: React.FC<BlockRendererProps<HeadingAttributes>> = ({ data }) => {
  const attributes = data.attributes
  switch (attributes.level) {
    case 1:
      return <H1>{attributes.content}</H1>
    case 2:
      return <H2>{attributes.content}</H2>
    case 3:
      return <H3>{attributes.content}</H3>
    case 4:
      return <H4>{attributes.content}</H4>
    case 5:
      return <H5>{attributes.content}</H5>
    case 6:
      return <H6>{attributes.content}</H6>
    default:
      return <H1>{attributes.content}</H1>
  }
}

export default HeadingBlock
