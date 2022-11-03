import { css } from "@emotion/css"
import { useContext } from "react"

import { BlockRendererProps } from "../../.."
import { ListAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { GlossaryContext } from "../../../../../contexts/GlossaryContext"
import { baseTheme } from "../../../../../shared-module/styles"
import { respondToOrLarger } from "../../../../../shared-module/styles/respond"
import withErrorBoundary from "../../../../../shared-module/utils/withErrorBoundary"
import colorMapper from "../../../../../styles/colorMapper"
import { fontSizeMapper, mobileFontSizeMapper } from "../../../../../styles/fontSizeMapper"
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
    ${fontSize && `font-size: ${mobileFontSizeMapper(fontSize)};`}
    ${textColor && `color: ${colorMapper(textColor)};`}
    ${backgroundColor && `background: ${colorMapper(backgroundColor)};`}
    ${gradient && `background: ${colorMapper(gradient)};`}
    ${backgroundColor && `padding: 1.25em 2.375em !important;`}
    padding-inline-start: 2.5rem !important;
    opacity: 0.9;
    overflow-wrap: break-word;

    ${respondToOrLarger.md} {
      font-size: ${fontSizeMapper(fontSize)};
    }

    li::marker {
      color: ${baseTheme.colors.grey[600]};
    }
  `

  const usesNewFormat = props.data.innerBlocks && props.data.innerBlocks.length > 0
  let dangerouslySetInnerHTML = undefined
  let children = undefined
  // We well use either children or dangerouslySetInnerHtml but not both at the same time
  if (!usesNewFormat) {
    dangerouslySetInnerHTML = {
      __html: parseText(values, terms).parsedText,
    }
  } else {
    children = <InnerBlocks parentBlockProps={props} />
  }

  if (ordered) {
    return (
      // eslint-disable-next-line react/no-danger-with-children
      <ol
        className={LIST_ITEM_CLASS}
        {...(anchor && { id: anchor })}
        {...(start && { start: start })}
        reversed={reversed}
        dangerouslySetInnerHTML={dangerouslySetInnerHTML}
        // eslint-disable-next-line react/no-children-prop
        children={children}
      />
    )
  } else {
    return (
      // eslint-disable-next-line react/no-danger-with-children
      <ul
        className={LIST_ITEM_CLASS}
        {...(anchor && { id: anchor })}
        dangerouslySetInnerHTML={dangerouslySetInnerHTML}
        // eslint-disable-next-line react/no-children-prop
        children={children}
      />
    )
  }
}

export default withErrorBoundary(ListBlock)
