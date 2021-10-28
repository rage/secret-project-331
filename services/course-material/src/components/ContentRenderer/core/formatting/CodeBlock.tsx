import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"

import { BlockRendererProps } from "../.."
import { CodeAttributes } from "../../../../../types/GutenbergBlockAttributes"
import { courseMaterialCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import fontSizeMapper from "../../../../styles/fontSizeMapper"

const CodeBlock: React.FC<BlockRendererProps<CodeAttributes>> = ({ data }) => {
  const { anchor, content, fontSize } = data.attributes
  return (
    <pre
      className={css`
        ${courseMaterialCenteredComponentStyles}
        ${fontSize && `font-size: ${fontSizeMapper(fontSize)};`}
        border: 1px solid #ddd;
        padding: 0.8rem 1rem !important;
        line-height: 1.75rem;
      `}
      {...(anchor && { id: anchor })}
    >
      <code dangerouslySetInnerHTML={{ __html: sanitizeHtml(content ?? "") }} />
    </pre>
  )
}

export default CodeBlock
