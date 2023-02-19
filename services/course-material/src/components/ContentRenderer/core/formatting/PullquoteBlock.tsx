import { css } from "@emotion/css"

import { BlockRendererProps } from "../.."
import { PullquoteAttributes } from "../../../../../types/GutenbergBlockAttributes"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"
import colorMapper from "../../../../styles/colorMapper"
import { sanitizeCourseMaterialHtml } from "../../../../utils/sanitizeCourseMaterialHtml"

const FONT_SIZES: { [key: string]: string } = {
  small: "10px",
  normal: "20px",
  medium: "30px",
  large: "34px",
  huge: "38px",
}

const PullquoteBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<PullquoteAttributes>>
> = ({ data }) => {
  const {
    citation,
    align,
    anchor,
    backgroundColor,
    // borderColor, // Border color is same as textColor in CMS
    // className,
    gradient,
    // style,
    textAlign,
    textColor,
    fontSize,
    value,
  } = data.attributes

  const textAlignNotCenterWidth =
    textAlign && textAlign !== "center" && !align ? "max-width: 26.25rem;" : null

  const size = FONT_SIZES[fontSize]

  return (
    <div
      className={css`
        ${textAlignNotCenterWidth}
      `}
    >
      <figure
        className={css`
          ${textColor && `color: ${colorMapper(textColor)};`}
          ${backgroundColor && `background: ${colorMapper(backgroundColor)};`}
          ${gradient && `background: ${colorMapper(gradient)};`}
          text-align: center;
          ${textAlign && `text-align: ${textAlign};`}
          border-top: 0.25rem solid #d5dbdf;
          border-bottom: 0.25rem solid #d5dbdf;
          padding: 3rem 0rem !important;
          margin-bottom: 1rem;
          ${align && `float: ${align};`}
          ${align === "right" ? "margin-left: 1rem;" : "margin-right: 1rem;"}
        `}
        {...(anchor && { id: anchor })}
      >
        <blockquote
          className={css`
            font-size: ${size};
            line-height: 1.6;
            margin-bottom: 1rem;
          `}
          dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(value ?? "") }}
        />
        <cite
          className={css`
            font-style: 20px;
            text-transform: capitalize !important;
          `}
          dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(citation) }}
        ></cite>
      </figure>
    </div>
  )
}

export default withErrorBoundary(PullquoteBlock)
