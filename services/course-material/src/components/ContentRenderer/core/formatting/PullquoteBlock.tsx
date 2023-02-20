import { css } from "@emotion/css"

import { BlockRendererProps } from "../.."
import { PullquoteAttributes } from "../../../../../types/GutenbergBlockAttributes"
import { baseTheme, headingFont } from "../../../../shared-module/styles"
import { respondToOrLarger } from "../../../../shared-module/styles/respond"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"
import colorMapper from "../../../../styles/colorMapper"
import { sanitizeCourseMaterialHtml } from "../../../../utils/sanitizeCourseMaterialHtml"

const FONT_SIZES: { [key: string]: string } = {
  small: "18px",
  normal: "22px",
  medium: "36px",
  large: "30px",
  huge: "34px",
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
    fontSize = "medium",
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
          margin: 3rem 0;
          ${align && `float: ${align};`}
          ${align === "right" ? "margin-left: 1rem;" : "margin-right: 1rem;"}
        `}
        {...(anchor && { id: anchor })}
      >
        <blockquote
          className={css`
            font-size: 22px;
            font-family: ${headingFont};
            font-weight
            line-height: 1.6;

            ${respondToOrLarger.md} {
              font-size: ${size};
            }
          `}
          dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(value ?? "") }}
        />
        <cite
          className={css`
            font-size: 20px;
            display: inline-block;
            font-family: ${headingFont};
            font-style: normal;
            text-transform: capitalize !important;
            margin-top: 1.2rem;
            color: ${baseTheme.colors.green[700]};
          `}
          dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(citation) }}
        ></cite>
      </figure>
    </div>
  )
}

export default withErrorBoundary(PullquoteBlock)
