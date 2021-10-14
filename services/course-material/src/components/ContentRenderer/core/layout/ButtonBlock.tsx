import { css } from "@emotion/css"

import { BlockRendererProps } from "../.."
import { courseMaterialCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import { ButtonAttributes } from "../../../../types/GutenbergBlockAttributes"

const ButtonBlock: React.FC<BlockRendererProps<ButtonAttributes>> = ({ data }) => {
  const innerBlocksAttributes = data.innerBlocks[0].attributes as ButtonAttributes
  return (
    <button
      className={css`
        ${courseMaterialCenteredComponentStyles}
      `}
    >
      {innerBlocksAttributes.text}
    </button>
  )
}

export default ButtonBlock
