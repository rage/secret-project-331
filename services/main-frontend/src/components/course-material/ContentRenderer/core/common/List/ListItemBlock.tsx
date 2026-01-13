"use client"
import { css, cx } from "@emotion/css"

import { BlockRendererProps } from "../../.."

import { ListItemAttributes } from "@/../types/GutenbergBlockAttributes"
import InnerBlocks from "@/components/course-material/ContentRenderer/util/InnerBlocks"
import ParsedText from "@/components/course-material/ParsedText"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { fontSizeMapper } from "@/styles/course-material/fontSizeMapper"

const ListItemBlock: React.FC<React.PropsWithChildren<BlockRendererProps<ListItemAttributes>>> = (
  props,
) => {
  const { content, fontSize } = props.data.attributes

  return (
    <li
      className={cx(
        props.wrapperClassName,
        css`
          font-size: 18px;
          ${respondToOrLarger.md} {
            font-size: ${fontSizeMapper(fontSize)};
          }
        `,
      )}
      id={props.id}
    >
      <ParsedText text={content} tag="span" useWrapperElement={true} />
      <InnerBlocks parentBlockProps={props} dontAllowInnerBlocksToBeWiderThanParentBlock />
    </li>
  )
}

const ListItemBlockWithErrorBoundary = withErrorBoundary(ListItemBlock)

// @ts-expect-error: Custom property. This block cannot be rendered with a wrapper div because it's only used inside ul elements and ul elements are not allowed to contain div elements. See: https://dequeuniversity.com/rules/axe/4.4/list
ListItemBlockWithErrorBoundary.dontRenderWrapperDivIllDoItMySelf = true
// @ts-expect-error: Custom property
ListItemBlockWithErrorBoundary.dontUseDefaultBlockMargin = true

export default ListItemBlockWithErrorBoundary
