import { css } from "@emotion/css"

import { BlockRendererProps } from "../.."
import { PullquoteAttributes } from "../../../../../types/GutenbergBlockAttributes"
import colorMapper from "../../../../styles/colorMapper"
import { sanitizeCourseMaterialHtml } from "../../../../utils/sanitizeCourseMaterialHtml"

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
    value,
  } = data.attributes

  const textAlignNotCenterWidth =
    textAlign && textAlign !== "center" && !align ? "max-width: 26.25rem;" : null

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
          border-top: 0.25rem solid currentColor;
          border-bottom: 0.25rem solid currentColor;
          padding: 3rem 0rem !important;
          margin-bottom: 1rem;
          ${align && `float: ${align};`}
          ${align === "right" ? "margin-left: 1rem;" : "margin-right: 1rem;"}
        `}
        {...(anchor && { id: anchor })}
      >
        <blockquote
          className={css`
            font-size: 1.75rem;
            line-height: 1.6;
          `}
          dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(value ?? "") }}
        />
        <cite
          className={css`
            font-style: normal;
            text-transform: uppercase;
          `}
          dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(citation) }}
        ></cite>
      </figure>
    </div>
  )
}

export default PullquoteBlock
