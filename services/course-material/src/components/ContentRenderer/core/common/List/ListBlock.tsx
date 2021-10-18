import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"

import { BlockRendererProps } from "../../.."
import { courseMaterialCenteredComponentStyles } from "../../../../../shared-module/styles/componentStyles"
import { defaultContainerWidth } from "../../../../../shared-module/styles/constants"
import colorMapper from "../../../../../styles/colorMapper"
import fontSizeMapper from "../../../../../styles/fontSizeMapper"
import { ListAttributes } from "../../../../../types/GutenbergBlockAttributes"

const ListBlock: React.FC<BlockRendererProps<ListAttributes>> = ({ data }) => {
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

  const listItemClasses = css`
    ${courseMaterialCenteredComponentStyles}
    max-width: ${defaultContainerWidth - 4.75}rem;
    ${fontSize && `font-size: ${fontSizeMapper(fontSize)};`}
    ${textColor && `color: ${colorMapper(textColor)};`}
    ${backgroundColor && `background: ${colorMapper(backgroundColor)};`}
    ${gradient && `background: ${colorMapper(gradient)};`}
  `

  if (ordered) {
    return (
      <ol
        className={listItemClasses}
        {...(anchor && { id: anchor })}
        {...(start && { start: start })}
        reversed={reversed}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(values) }}
      />
    )
  } else {
    return (
      <ul
        className={listItemClasses}
        {...(anchor && { id: anchor })}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(values) }}
      />
    )
  }
}

export default ListBlock
