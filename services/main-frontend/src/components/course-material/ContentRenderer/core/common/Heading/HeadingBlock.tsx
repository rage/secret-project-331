"use client"

/* oxlint-disable jsx-a11y/heading-has-content */
import { css, cx } from "@emotion/css"
import type { DetailedHTMLProps, HTMLAttributes } from "react"
import { useContext } from "react"

import type { HeadingAttributes } from "@/../types/GutenbergBlockAttributes"
import { HeadingAnchorsContext } from "@/contexts/course-material/HeadingAnchorsContext"
import { INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS } from "@/shared-module/common/utils/constants"
import { headingTextFromHtml } from "@/shared-module/common/utils/headingAnchors"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { fontSizeMapper } from "@/styles/course-material/fontSizeMapper"
import { marginTopHeadingMapper } from "@/styles/course-material/headerMarginMapper"
import { sanitizeCourseMaterialHtml } from "@/utils/course-material/sanitizeCourseMaterialHtml"

import type { BlockRendererProps } from "../../.."
import HeadingAnchorLink, { HEADING_ANCHOR_LINK_CLASS } from "./HeadingAnchorLink"

interface ExtraAttributes {
  textAlign?: string
}

const HeadingBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<HeadingAttributes & ExtraAttributes>>
> = ({ data }) => {
  const { content, level, fontSize, textAlign, fitText } = data.attributes
  const anchorId = useContext(HeadingAnchorsContext).get(data.clientId)

  const headingProps: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement> = {
    id: anchorId,
    children: (
      <>
        <span dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(content) }} />
        {anchorId && (
          <HeadingAnchorLink anchorId={anchorId} headingText={headingTextFromHtml(content)} />
        )}
      </>
    ),
    className: cx(
      level < 4 && INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS,
      css`
        line-height: ${level === 1 ? 1.1 : 1.2};
        margin-bottom: 1rem;
        margin-top: ${marginTopHeadingMapper(level)};
        font-weight: 600;
        ${textAlign && `text-align: ${textAlign};`}
        ${
          fitText && `font-size: clamp(1rem, 4vw, ${fontSize ? fontSizeMapper(fontSize) : "3rem"});`
        }
        ${!fitText && fontSize && `font-size: ${fontSizeMapper(fontSize)};`}

        &:hover .${HEADING_ANCHOR_LINK_CLASS}, &:focus-within .${HEADING_ANCHOR_LINK_CLASS} {
          opacity: 1;
        }
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
