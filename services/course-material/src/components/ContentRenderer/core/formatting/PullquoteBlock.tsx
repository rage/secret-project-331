import { css } from "@emotion/css"

import { BlockRendererProps } from "../.."
import { PullquoteAttributes } from "../../../../../types/GutenbergBlockAttributes"
import { sanitizeCourseMaterialHtml } from "../../../../utils/sanitizeCourseMaterialHtml"

import { baseTheme, headingFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

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
    // borderColor, // Border color is same as textColor in CMS
    // className,
    // style,
    textAlign,
    fontSize = "medium",
    value,
  } = data.attributes

  const size = FONT_SIZES[fontSize]

  return (
    <div>
      <figure
        className={css`
          text-align: center;
          ${textAlign && `text-align: ${textAlign};`}
          border-top: 0.25rem solid #d5dbdf;
          border-bottom: 0.25rem solid #d5dbdf;
          padding: 3rem 0rem !important;
        `}
      >
        <blockquote
          className={css`
            font-size: 22px;
            font-family: ${headingFont};
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
