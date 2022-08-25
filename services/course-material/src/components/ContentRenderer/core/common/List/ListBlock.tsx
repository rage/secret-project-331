import { css } from "@emotion/css"
import { useContext } from "react"

import { BlockRendererProps } from "../../.."
import { ListAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { GlossaryContext } from "../../../../../contexts/GlossaryContext"
import colorMapper from "../../../../../styles/colorMapper"
import fontSizeMapper from "../../../../../styles/fontSizeMapper"
import { parseText } from "../../../util/textParsing"

const ListBlock: React.FC<React.PropsWithChildren<BlockRendererProps<ListAttributes>>> = ({
  data,
}) => {
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
  } = data.attributes

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

  if (ordered) {
    return (
      <ol
        className={LIST_ITEM_CLASS}
        {...(anchor && { id: anchor })}
        {...(start && { start: start })}
        reversed={reversed}
        dangerouslySetInnerHTML={{
          __html: parseText(values, terms).parsedText,
        }}
      />
    )
  } else {
    return (
      <ul
        className={LIST_ITEM_CLASS}
        {...(anchor && { id: anchor })}
        dangerouslySetInnerHTML={{
          __html: parseText(values, terms).parsedText,
        }}
      />
    )
  }
}

export default ListBlock
