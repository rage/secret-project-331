import { css } from "@emotion/css"

import { BlockRendererProps } from "../.."
import { courseMaterialCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import fontSizeMapper from "../../../../styles/fontSizeMapper"
import { CodeAttributes } from "../../../../types/GutenbergBlockAttributes"

const CodeBlock: React.FC<BlockRendererProps<CodeAttributes>> = ({ data }) => {
  const { anchor, content, fontSize } = data.attributes
  return (
    <pre
      className={css`
        ${courseMaterialCenteredComponentStyles}
        ${fontSize && `font-size: ${fontSizeMapper(fontSize)};`}
        border: 1px solid #ddd;
        padding: 0.8em 1em;
      `}
      {...(anchor && { id: anchor })}
    >
      <code>{content}</code>
    </pre>
  )
}

export default CodeBlock
