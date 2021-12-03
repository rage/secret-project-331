import { css } from "@emotion/css"

import { BlockAttributes } from "../../../types/GutenbergBlockAttributes"
import { normalWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"

import { BlockRendererProps } from "."

const DefaultBlock: React.FC<BlockRendererProps<BlockAttributes>> = ({ data }) => {
  return (
    <pre
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      {JSON.stringify(data, undefined, 2)}
    </pre>
  )
}

export default DefaultBlock
