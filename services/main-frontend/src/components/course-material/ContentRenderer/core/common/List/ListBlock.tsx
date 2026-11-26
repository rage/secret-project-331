"use client"

import { css, cx } from "@emotion/css"
import { useContext } from "react"

import type { ListAttributes } from "@/../types/GutenbergBlockAttributes"
import InnerBlocks from "@/components/course-material/ContentRenderer/util/InnerBlocks"
import ParsedText from "@/components/course-material/ParsedText"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { fontSizeMapper, mobileFontSizeMapper } from "@/styles/course-material/fontSizeMapper"

import type { BlockRendererProps } from "../../.."
import ListFontSizeContext from "./listFontSizeContext"

const LIST_BLOCK_CLASS_NAME = "course-material-list-block"
/** About one line of text on a phone. */
const LONG_ITEM_CHARACTERS = 60

const textLength = (html: string | undefined) =>
  (html ?? "").replaceAll(/<[^>]*>/g, "").trim().length

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

  const parentFontSize = useContext(ListFontSizeContext)
  const hasLongItems = props.data.innerBlocks?.some(
    (item) =>
      textLength((item.attributes as { content?: string } | undefined)?.content) >
      LONG_ITEM_CHARACTERS,
  )

  const listItemClass = cx(
    css`
      ${fontSize && `font-size: ${mobileFontSizeMapper(fontSize)};`}

      padding-inline-start: 2.5rem !important;
      margin-block: 0;
      overflow-wrap: break-word;

      ${respondToOrLarger.md} {
        font-size: ${fontSizeMapper(fontSize)};
      }

      li::marker {
        color: ${baseTheme.colors.gray[600]};
      }

      /* Items that run over several lines need space between them to read as separate points. */
      ${hasLongItems && `> li + li { margin-top: 0.5em; }`}
    `,
    LIST_BLOCK_CLASS_NAME,
  )

  const usesNewFormat = props.data.innerBlocks && props.data.innerBlocks.length > 0
  let children
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
    }
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
  children = <InnerBlocks parentBlockProps={props} dontAllowInnerBlocksToBeWiderThanParentBlock />

  if (ordered) {
    return (
      <ListFontSizeContext.Provider value={fontSize ?? parentFontSize}>
        <ol className={listItemClass} {...(start && { start: start })} reversed={reversed}>
          {children}
        </ol>
      </ListFontSizeContext.Provider>
    )
  }
  return (
    <ListFontSizeContext.Provider value={fontSize ?? parentFontSize}>
      <ul className={listItemClass}>{children}</ul>
    </ListFontSizeContext.Provider>
  )
}

const exported = withErrorBoundary(ListBlock)

export default exported
