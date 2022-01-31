import { css } from "@emotion/css"

import { BlockRendererProps } from "../../.."
import { QuoteAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { sanitizeCourseMaterialHtml } from "../../../../../utils/sanitizeCourseMaterialHtml"

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
          dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(value) }}
        />
        <cite
          className={css`
            text-align: right;
            display: block;
            font-size: 1.125rem;
            font-style: normal;
          `}
          dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(citation) }}
        ></cite>
      </blockquote>
    )
  } else {
    return (
      <blockquote
        className={css`
          ${((align && align === "left") || !align) && styleLeftDefault}
          ${align && align === "right" && styleRightDefault}
          ${align && align === "center" && styleCenterDefault}
          margin-bottom: 1.75rem;
        `}
        cite={citation}
        {...(anchor && { id: anchor })}
      >
        <div
          dangerouslySetInnerHTML={{
            __html: sanitizeCourseMaterialHtml(value),
          }}
        />
        <cite
          className={css`
            font-style: normal;
            font-size: 0.8125rem;
          `}
          dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(citation) }}
        ></cite>
      </blockquote>
    )
  }
}

export default QuoteBlock
