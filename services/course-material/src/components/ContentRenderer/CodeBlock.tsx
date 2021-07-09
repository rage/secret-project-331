import { css } from "@emotion/css"

import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"

import { BlockRendererProps } from "."

interface CodeBlockAttributes {
  content: string
}

const CodeBlock: React.FC<BlockRendererProps<CodeBlockAttributes>> = ({ data }) => {
  const attributes: CodeBlockAttributes = data.attributes
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
