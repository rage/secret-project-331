import { css } from "@emotion/css"

import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import { BlockAttributes } from "../../types/GutenbergBlockAttributes"

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
