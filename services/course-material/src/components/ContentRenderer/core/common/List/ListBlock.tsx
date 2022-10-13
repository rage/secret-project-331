import { css } from "@emotion/css"
import { useContext } from "react"

import { BlockRendererProps } from "../../.."
import { ListAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { GlossaryContext } from "../../../../../contexts/GlossaryContext"
import colorMapper from "../../../../../styles/colorMapper"
import fontSizeMapper from "../../../../../styles/fontSizeMapper"
import InnerBlocks from "../../../util/InnerBlocks"
import { parseText } from "../../../util/textParsing"

const ListBlock: React.FC<React.PropsWithChildren<BlockRendererProps<ListAttributes>>> = (
  props,
) => {
  const {
    ordered,
    values,
    anchor,
    backgroundColor,
    // className,
    fontSize,
    gradient,
    // placeholder,
    reversed,
    start,
    // style,
    textColor,
    // type,
  } = props.data.attributes

  const { terms } = useContext(GlossaryContext)

  const LIST_ITEM_CLASS = css`
    ${fontSize && `font-size: ${fontSizeMapper(fontSize)};`}
    ${textColor && `color: ${colorMapper(textColor)};`}
    ${backgroundColor && `background: ${colorMapper(backgroundColor)};`}
    ${gradient && `background: ${colorMapper(gradient)};`}
    ${backgroundColor && `padding: 1.25em 2.375em !important;`}
    padding-inline-start: 2.5rem !important;
    overflow-wrap: break-word;
  `

  const usesNewFormat = props.data.innerBlocks && props.data.innerBlocks.length > 0
  let dangerouslySetInnerHTML = undefined
  if (!usesNewFormat) {
    dangerouslySetInnerHTML = {
      __html: parseText(values, terms).parsedText,
    }
  }

  if (ordered) {
    return (
      <ol
        className={LIST_ITEM_CLASS}
        {...(anchor && { id: anchor })}
        {...(start && { start: start })}
        reversed={reversed}
        dangerouslySetInnerHTML={dangerouslySetInnerHTML}
      >
        {usesNewFormat && <InnerBlocks parentBlockProps={props} />}
      </ol>
    )
  } else {
    return (
      <ul
        className={LIST_ITEM_CLASS}
        {...(anchor && { id: anchor })}
        dangerouslySetInnerHTML={dangerouslySetInnerHTML}
      >
        {usesNewFormat && <InnerBlocks parentBlockProps={props} />}
      </ul>
    )
  }
}

export default ListBlock
