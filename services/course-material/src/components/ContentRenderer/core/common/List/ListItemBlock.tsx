import { useContext } from "react"

import { BlockRendererProps } from "../../.."
import { ListItemAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { GlossaryContext } from "../../../../../contexts/GlossaryContext"
import InnerBlocks from "../../../util/InnerBlocks"
import { parseText } from "../../../util/textParsing"

const ListItemBlock: React.FC<React.PropsWithChildren<BlockRendererProps<ListItemAttributes>>> = (
  props,
) => {
  const { content } = props.data.attributes

  const { terms } = useContext(GlossaryContext)

  return (
    <li className={props.wrapperClassName} id={props.id}>
      <span dangerouslySetInnerHTML={{ __html: parseText(content, terms).parsedText }} />
      <InnerBlocks parentBlockProps={props} />
    </li>
  )
}

// @ts-expect-error: Custom property. This block cannot be rendered with a wrapper div because it's only used inside ul elements and ul elements are not allowed to contain div elements. See: https://dequeuniversity.com/rules/axe/4.4/list
ListItemBlock.dontRenderWrapperDivIllDoItMySelf = true

export default ListItemBlock
