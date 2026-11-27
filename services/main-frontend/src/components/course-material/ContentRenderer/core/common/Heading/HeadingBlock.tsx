"use client"

/* oxlint-disable jsx-a11y/heading-has-content */
import { css, cx } from "@emotion/css"
import type { DetailedHTMLProps, HTMLAttributes } from "react"
import { useId } from "react"

import type { HeadingAttributes } from "@/../types/GutenbergBlockAttributes"
import { baseTheme } from "@/shared-module/common/styles"
import { INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS } from "@/shared-module/common/utils/constants"
import {
  HEADING_ANCHOR_ID_PART_LENGTH,
  headingTextFromHtml,
  slugifyHeadingText,
} from "@/shared-module/common/utils/headingAnchors"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { fontSizeMapper } from "@/styles/course-material/fontSizeMapper"
import { sanitizeCourseMaterialHtml } from "@/utils/course-material/sanitizeCourseMaterialHtml"

import type { BlockRendererProps } from "../../.."
import { textAlignOf } from "../../../util/textAlign"
import HeadingAnchorLink, { HEADING_ANCHOR_LINK_CLASS } from "./HeadingAnchorLink"

interface ExtraAttributes {
  textAlign?: string
}

const HeadingBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<HeadingAttributes & ExtraAttributes>>
> = ({ data, isExam }) => {
  const { content, level, fontSize, fitText, style, anchor } = data.attributes
  const textAlign = textAlignOf(style, data.attributes.textAlign)
  const headingText = headingTextFromHtml(content)
  const idPart = data.clientId.replaceAll("-", "").slice(0, HEADING_ANCHOR_ID_PART_LENGTH)
  const anchorId = anchor?.trim() || `${idPart}-${slugifyHeadingText(headingText)}`
  const contentId = useId()

  const headingProps: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement> = {
    id: anchorId,
    // Keeps the anchor link and its status out of the heading's accessible name.
    "aria-labelledby": contentId,
    children: (
      <>
        <span
          id={contentId}
          dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(content) }}
        />
        <HeadingAnchorLink anchorId={anchorId} headingText={headingText} />
      </>
    ),
    className: cx(
      level < 4 && INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS,
      css`
        position: relative;
        line-height: ${level === 1 ? 1.1 : 1.2};
        margin: 0;
        font-weight: 600;
        ${textAlign && `text-align: ${textAlign};`}
        ${
          fitText && `font-size: clamp(1rem, 4vw, ${fontSize ? fontSizeMapper(fontSize) : "3rem"});`
        }
        ${!fitText && fontSize && `font-size: ${fontSizeMapper(fontSize)};`}
        /* Levels 5 and 6 read as small labels, so they don't look like a bold paragraph. */
        ${
          level >= 5 &&
          !fontSize &&
          !fitText &&
          `font-size: 0.9375rem; text-transform: uppercase; letter-spacing: 0.06em; color: ${baseTheme.colors.gray[500]};`
        }

        &:hover .${HEADING_ANCHOR_LINK_CLASS}, &:focus-within .${HEADING_ANCHOR_LINK_CLASS} {
          opacity: 1;
        }
      `,
    ),
  }
  // Exams have their own h1, so authored level-1 headings render as h2 there.
  switch (isExam && (level === 1 || !level) ? 2 : level) {
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

export default exported
