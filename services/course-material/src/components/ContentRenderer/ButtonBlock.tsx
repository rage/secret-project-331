import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import { ButtonAttributes } from "../../types/GutenbergBlockAttributes"


const ButtonBlock: React.FC<BlockRendererProps<ButtonAttributes>> = ({ data }) => {
  const innerBlocks: ButtonAttributes = data.innerBlocks[0].attributes
  return (
    <button
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      {innerBlocks.text}
    </button>
  )
}

export default ButtonBlock
