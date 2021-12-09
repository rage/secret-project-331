import { css } from "@emotion/css"

import { BlockRendererProps } from "../.."
import { CodeAttributes } from "../../../../../types/GutenbergBlockAttributes"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import fontSizeMapper from "../../../../styles/fontSizeMapper"
import { sanitizeCourseMaterialHtml } from "../../../../utils/sanitizeCourseMaterialHtml"

const CodeBlock: React.FC<BlockRendererProps<CodeAttributes>> = ({ data }) => {
  const { anchor, content, fontSize } = data.attributes
  return (
    <pre
      className={css`
        ${normalWidthCenteredComponentStyles}
        ${fontSize && `font-size: ${fontSizeMapper(fontSize)};`}
        border: 1px solid #ddd;
        padding: 0.8rem 1rem !important;
        line-height: 1.75rem;
        white-space: pre-wrap;
      `}
      {...(anchor && { id: anchor })}
    >
      <code dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(content ?? "") }} />
    </pre>
  )
}

export default CodeBlock
