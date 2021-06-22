import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import { CodeAttributes } from "../../types/GutenbergBlockAttributes"


const CodeBlock: React.FC<BlockRendererProps<CodeAttributes>> = ({ data }) => {
  const attributes: CodeAttributes = data.attributes
  return (
    <pre
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      <code>{attributes.content}</code>
    </pre>
  )
}

export default CodeBlock
