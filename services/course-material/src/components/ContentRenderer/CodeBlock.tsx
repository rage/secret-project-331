import { css } from "@emotion/css"

import { CodeAttributes } from "../../../types/GutenbergBlockAttributes"
import { courseMaterialCenteredComponentStyles } from "../../shared-module/styles/componentStyles"

import { BlockRendererProps } from "."

const CodeBlock: React.FC<BlockRendererProps<CodeAttributes>> = ({ data }) => {
  const attributes: CodeAttributes = data.attributes
  return (
    <pre
      className={css`
        ${courseMaterialCenteredComponentStyles}
      `}
    >
      <code>{attributes.content}</code>
    </pre>
  )
}

export default CodeBlock
