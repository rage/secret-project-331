import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"

interface CodeBlockAttributes {
  content: string
}

const CodeBlock: React.FC<BlockRendererProps<CodeBlockAttributes>> = ({ data }) => {
  const attributes: CodeBlockAttributes = data.attributes
  return (
    <code
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
    {attributes.content}
    </code>
  )
}

export default CodeBlock
