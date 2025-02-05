import { css, cx } from "@emotion/css"
import { useContext } from "react"

import { BlockRendererProps } from "../../.."
import { ListAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { GlossaryContext } from "../../../../../contexts/GlossaryContext"
import { fontSizeMapper, mobileFontSizeMapper } from "../../../../../styles/fontSizeMapper"
import InnerBlocks from "../../../util/InnerBlocks"
import { parseText } from "../../../util/textParsing"

import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const LIST_BLOCK_CLASS_NAME = "course-material-list-block"

const ListBlock: React.FC<React.PropsWithChildren<BlockRendererProps<ListAttributes>>> = (
  props,
) => {
  const {
    ordered,
    values,
    // className,
    fontSize,
    // placeholder,
    reversed,
    start,
    // style,
    // type,
  } = props.data.attributes

  const { terms } = useContext(GlossaryContext)

  const listItemClass = cx(
    css`
      ${fontSize && `font-size: ${mobileFontSizeMapper(fontSize)};`}

      padding-inline-start: 2.5rem !important;
      overflow-wrap: break-word;

      ${respondToOrLarger.md} {
        font-size: ${fontSizeMapper(fontSize)};
      }

      li::marker {
        color: ${baseTheme.colors.gray[600]};
      }
    `,
    LIST_BLOCK_CLASS_NAME,
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
