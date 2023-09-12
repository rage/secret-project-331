import { css, cx } from "@emotion/css"
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

const listBlockClassName = "course-material-list-block"

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

  const listItemClass = cx(
    css`
      ${fontSize && `font-size: ${mobileFontSizeMapper(fontSize)};`}
      ${textColor && `color: ${colorMapper(textColor)};`}
    ${backgroundColor && `background: ${colorMapper(backgroundColor)};`}
    ${gradient && `background: ${colorMapper(gradient)};`}
    ${backgroundColor && `padding: 1.25em 2.375em !important;`}
    padding-inline-start: 2.5rem !important;
      overflow-wrap: break-word;

      ${respondToOrLarger.md} {
        font-size: ${fontSizeMapper(fontSize)};
      }

      li::marker {
        color: ${baseTheme.colors.gray[600]};
      }
    `,
    listBlockClassName,
  )

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
        className={listItemClass}
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
        className={listItemClass}
        {...(anchor && { id: anchor })}
        dangerouslySetInnerHTML={dangerouslySetInnerHTML}
        // eslint-disable-next-line react/no-children-prop
        children={children}
      />
    )
  }
}

const exported = withErrorBoundary(ListBlock)
// @ts-expect-error: Custom property
exported.dontUseDefaultBlockMargin = true

export default exported
