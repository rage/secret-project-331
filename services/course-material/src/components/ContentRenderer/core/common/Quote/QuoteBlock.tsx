import { css } from "@emotion/css"

import { BlockRendererProps } from "../../.."
import { QuoteAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { sanitizeCourseMaterialHtml } from "../../../../../utils/sanitizeCourseMaterialHtml"
import InnerBlocks from "../../../util/InnerBlocks"

const QuoteBlock: React.FC<React.PropsWithChildren<BlockRendererProps<QuoteAttributes>>> = (
  props,
) => {
  const { citation, value, anchor, className, align } = props.data.attributes

  const styleLeftDefault = css`
    padding: 0.5rem 2rem;
    margin: 2.5rem 0;
    max-width: 650px;
    border-left: 7px solid #bfbfbf;
  `
  const styleRightDefault = css`
    padding: 0.5rem 2rem;
    margin: 2.5rem 0;
    max-width: 650px;
    border-right: 7px solid #bfbfbf;
    text-align: right;
  `
  const styleCenterDefault = css`
    margin-bottom: 1.75em;
    text-align: center;
  `
  if (className && className.includes("is-style-large")) {
    return (
      <>
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
          >
            {value && value}
            <InnerBlocks parentBlockProps={props} />
          </div>
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
      </>
    )
  } else {
    return (
      <>
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
          <div>
            {value && value}
            <InnerBlocks parentBlockProps={props} />
          </div>
          <cite
            className={css`
              font-style: normal;
              font-size: 0.8125rem;
            `}
            dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(citation) }}
          ></cite>
        </blockquote>
      </>
    )
  }
}

export default QuoteBlock
