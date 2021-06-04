import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"

const DefaultBlock: React.FC<BlockRendererProps<unknown>> = ({ data }) => {
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
