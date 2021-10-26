import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"

import { BlockRendererProps } from "../../.."
import { courseMaterialCenteredComponentStyles } from "../../../../../shared-module/styles/componentStyles"
import { QuoteAttributes } from "../../../../../types/GutenbergBlockAttributes"

const QuoteBlock: React.FC<BlockRendererProps<QuoteAttributes>> = ({ data }) => {
  const { citation, value, anchor, className, align } = data.attributes

  const styleLeftDefault = css`
    padding-left: 1rem !important;
    border-left: 0.25rem solid #000;
  `
  const styleRightDefault = css`
    padding-right: 1rem !important;
    border-right: 0.25rem solid #000;
    text-align: right;
  `
  const styleCenterDefault = css`
    margin-bottom: 1.75em;
    text-align: center;
  `

  if (className && className.includes("is-style-large")) {
    return (
      <blockquote
        className={css`
          ${courseMaterialCenteredComponentStyles}
          margin-bottom: 1rem;
          padding: 0 1rem;
        `}
        cite={citation}
        {...(anchor && { id: anchor })}
      >
        <div
          className={css`
            font-size: 1.5rem;
            ${align && `text-align: ${align};`}
            font-style: italic;
          `}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }}
        />
        <cite
          className={css`
            text-align: right;
            display: block;
            font-size: 1.125rem;
            font-style: normal;
          `}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(citation) }}
        ></cite>
      </blockquote>
    )
  } else {
    return (
      <blockquote
        className={css`
          ${courseMaterialCenteredComponentStyles}
          ${((align && align === "left") || !align) && styleLeftDefault}
          ${align && align === "right" && styleRightDefault}
          ${align && align === "center" && styleCenterDefault}
          margin-bottom: 1.75rem;
        `}
        cite={citation}
        {...(anchor && { id: anchor })}
      >
        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }} />
        <cite
          className={css`
            font-style: normal;
            font-size: 0.8125rem;
          `}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(citation) }}
        ></cite>
      </blockquote>
    )
  }
}

export default QuoteBlock
