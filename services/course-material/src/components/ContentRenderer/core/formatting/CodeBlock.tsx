import { css } from "@emotion/css"

import { BlockRendererProps } from "../.."
import { CodeAttributes } from "../../../../../types/GutenbergBlockAttributes"
import fontSizeMapper from "../../../../styles/fontSizeMapper"
import { sanitizeCourseMaterialHtml } from "../../../../utils/sanitizeCourseMaterialHtml"

const CodeBlock: React.FC<React.PropsWithChildren<BlockRendererProps<CodeAttributes>>> = ({
  data,
}) => {
  const { anchor, content, fontSize } = data.attributes
  return (
    <pre
      className={css`
        ${fontSize && `font-size: ${fontSizeMapper(fontSize)};`}
        border: 1px solid #ddd;
        padding: 0.8rem 1rem !important;
        line-height: 1.75rem;
        white-space: pre-wrap;
        overflow-wrap: break-word;
      `}
      {...(anchor && { id: anchor })}
    >
      <code dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(content ?? "") }} />
    </pre>
  )
}

export default CodeBlock
