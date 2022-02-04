/* eslint-disable i18next/no-literal-string */
/* eslint-disable jsx-a11y/heading-has-content */
import { css } from "@emotion/css"
import { DetailedHTMLProps, HTMLAttributes } from "react"

import { BlockRendererProps } from "../../.."
import { HeadingAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import colorMapper from "../../../../../styles/colorMapper"
import fontSizeMapper from "../../../../../styles/fontSizeMapper"
import { sanitizeCourseMaterialHtml } from "../../../../../utils/sanitizeCourseMaterialHtml"

const HeadingBlock: React.FC<BlockRendererProps<HeadingAttributes>> = ({ data }) => {
  const {
    content,
    level,
    // align,
    anchor,
    backgroundColor,
    // className,
    fontSize,
    // placeholder,
    // style,
    textAlign,
    textColor,
  } = data.attributes

  const headingProps: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement> = {
    dangerouslySetInnerHTML: {
      __html: sanitizeCourseMaterialHtml(content),
    },
    className: css`
      ${textAlign && `text-align: ${textAlign};`}
      ${textColor && `color: ${colorMapper(textColor, "#000000")};`}
      ${backgroundColor && `background-color: ${colorMapper(backgroundColor)};`}
      ${fontSize && `font-size: ${fontSizeMapper(fontSize)};`}
      ${backgroundColor && "padding: 2.66rem 5rem !important;"}
    `,
    ...(anchor ? { id: anchor } : {}),
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

export default HeadingBlock
