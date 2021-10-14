import { css } from "@emotion/css"

import { BlockRendererProps } from "../.."
import { courseMaterialCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import { CodeAttributes } from "../../../../types/GutenbergBlockAttributes"

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
