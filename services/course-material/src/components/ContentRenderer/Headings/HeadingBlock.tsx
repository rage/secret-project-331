/* eslint-disable i18next/no-literal-string */
/* eslint-disable jsx-a11y/heading-has-content */
import { css } from "@emotion/css"
import { DetailedHTMLProps, HTMLAttributes } from "react"
import sanitizeHtml from "sanitize-html"

import { BlockRendererProps } from ".."
import { courseMaterialCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"
import colorMapper from "../../../styles/colorMapper"
import fontSizeMapper from "../../../styles/fontSizeMapper"
import { HeadingAttributes } from "../../../types/GutenbergBlockAttributes"

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
      // TODO: Figure out how to support inline html classes, for example inline color.
      __html: sanitizeHtml(content),
    },
    className: css`
      ${courseMaterialCenteredComponentStyles}
      text-align: ${textAlign ?? "left"};
      color: ${colorMapper(textColor, "#000000")};
      background-color: ${colorMapper(backgroundColor, "unset")};
      ${fontSize && `font-size: ${fontSizeMapper(fontSize)};`}
      ${backgroundColor && "padding: 1.25rem 2.375rem !important;"}
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
