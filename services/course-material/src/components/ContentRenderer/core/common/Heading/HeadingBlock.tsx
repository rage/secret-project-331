/* eslint-disable jsx-a11y/heading-has-content */
import { css, cx } from "@emotion/css"
import { DetailedHTMLProps, HTMLAttributes } from "react"

import { BlockRendererProps } from "../../.."
import { HeadingAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { fontSizeMapper } from "../../../../../styles/fontSizeMapper"
import { marginTopHeadingMapper } from "../../../../../styles/headerMarginMapper"
import { sanitizeCourseMaterialHtml } from "../../../../../utils/sanitizeCourseMaterialHtml"

import { INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS } from "@/shared-module/common/utils/constants"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const HeadingBlock: React.FC<React.PropsWithChildren<BlockRendererProps<HeadingAttributes>>> = ({
  data,
}) => {
  const {
    content,
    level,
    // align,
    // className,
    fontSize,
    // placeholder,
    // style,
    textAlign,
  } = data.attributes

  const headingProps: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement> = {
    dangerouslySetInnerHTML: {
      __html: sanitizeCourseMaterialHtml(content),
    },
    className: cx(
      level < 4 && INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS,
      css`
        line-height: ${level === 1 ? 1.1 : 1.2};
        margin-bottom: 1rem;
        margin-top: ${marginTopHeadingMapper(level)};
        font-weight: 600;
        ${textAlign && `text-align: ${textAlign};`}
        ${fontSize && `font-size: ${fontSizeMapper(fontSize)};`}
      `,
    ),
  }
  switch (level) {
    case 1:
      return <h1 {...headingProps} />
    case 2:
      return <h2 {...headingProps} />
    case 3:
      return <h3 {...headingProps} />
    case 4:
      return <h4 {...headingProps} />
    case 5:
      return <h5 {...headingProps} />
    case 6:
      return <h6 {...headingProps} />
    default:
      return <h1 {...headingProps} />
  }
}

const exported = withErrorBoundary(HeadingBlock)
// @ts-expect-error: Custom property
exported.dontUseDefaultBlockMargin = true

export default exported
