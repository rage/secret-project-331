"use client"
import { css, cx } from "@emotion/css"

import { BlockRendererProps } from "../../.."

import { ListAttributes } from "@/../types/GutenbergBlockAttributes"
import ParsedText from "@/components/ParsedText"
import InnerBlocks from "@/components/course-material/ContentRenderer/util/InnerBlocks"
import { GlossaryContext } from "@/contexts/course-material/GlossaryContext"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { fontSizeMapper, mobileFontSizeMapper } from "@/styles/course-material/fontSizeMapper"
import { fontSizeMapper, mobileFontSizeMapper } from "@/styles/fontSizeMapper"

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
  let children = undefined
  // This is for handling pages saved with an older version of Gutenberg, where list blocks did not have list item blocks as innerblocks but it had the list items as HTML strings.
  if (!usesNewFormat) {
    if (ordered) {
      return (
        <ParsedText
          text={values}
          tag="ol"
          tagProps={{
            className: listItemClass,
            ...(start && { start }),
            reversed,
          }}
          useWrapperElement={true}
        />
      )
    } else {
      return (
        <ParsedText
          text={values}
          tag="ul"
          tagProps={{
            className: listItemClass,
          }}
          useWrapperElement={true}
        />
      )
    }
  } else {
    children = <InnerBlocks parentBlockProps={props} dontAllowInnerBlocksToBeWiderThanParentBlock />
  }

  if (ordered) {
    return (
      <ol className={listItemClass} {...(start && { start: start })} reversed={reversed}>
        {children}
      </ol>
    )
  } else {
    return <ul className={listItemClass}>{children}</ul>
  }
}

const exported = withErrorBoundary(ListBlock)
// @ts-expect-error: Custom property
exported.dontUseDefaultBlockMargin = true

export default exported
