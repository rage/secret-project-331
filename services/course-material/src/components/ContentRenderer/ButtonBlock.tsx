import { css } from "@emotion/css"

import { normalWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import { ButtonAttributes } from "../../types/GutenbergBlockAttributes"

import { BlockRendererProps } from "."

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
