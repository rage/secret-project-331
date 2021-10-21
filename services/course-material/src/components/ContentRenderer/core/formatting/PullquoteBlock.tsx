import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"

import { BlockRendererProps } from "../.."
import { courseMaterialCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import colorMapper from "../../../../styles/colorMapper"
import { PullquoteAttributes } from "../../../../types/GutenbergBlockAttributes"

const PullquoteBlock: React.FC<BlockRendererProps<PullquoteAttributes>> = ({ data }) => {
  const {
    citation,
    //align,
    anchor,
    backgroundColor,
    // borderColor, // Border color is same as textColor in CMS
    //className,
    gradient,
    //style,
    textAlign,
    textColor,
    value,
  } = data.attributes

  const textAlignNotCenterWidth = textAlign && textAlign !== "center" ? "max-width: 30rem;" : null
  const textAndBorderColor = colorMapper(textColor, "#000")

  return (
    <div
      className={css`
        ${courseMaterialCenteredComponentStyles}
        ${textColor && `color: ${textAndBorderColor};`}
        ${backgroundColor && `background: ${colorMapper(backgroundColor)};`}
        ${gradient && `background: ${colorMapper(gradient)};`}
        text-align: center;
        ${textAlign && `text-align: ${textAlign};`}
        ${textAlignNotCenterWidth}
        border-top: 0.25rem solid ${textAndBorderColor};
        border-bottom: 0.25rem solid ${textAndBorderColor};
        padding: 3rem 0;
      `}
      {...(anchor && { id: anchor })}
    >
      <p
        className={css`
          font-size: 1.75rem;
          line-height: 1.6;
        `}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(value ?? "") }}
      ></p>
      <cite
        className={css`
          font-style: normal;
          text-transform: uppercase;
        `}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(citation) }}
      ></cite>
    </div>
  )
}

export default PullquoteBlock
