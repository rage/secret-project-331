import { css } from "@emotion/css"
import React from "react"

import { BlockRendererProps } from "../.."
import { SpacerAttributes } from "../../../../types/GutenbergBlockAttributes"

const SpacerBlock: React.FC<BlockRendererProps<SpacerAttributes>> = ({ data }) => {
  const attributes: SpacerAttributes = data.attributes

  return (
    <div
      className={css`
        height: ${attributes.height}px;
        width: ${attributes.width}px;
      `}
    />
  )
}

export default SpacerBlock
