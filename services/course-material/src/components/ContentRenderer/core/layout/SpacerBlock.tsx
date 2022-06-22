import { css } from "@emotion/css"
import React from "react"

import { BlockRendererProps } from "../.."
import { SpacerAttributes } from "../../../../../types/GutenbergBlockAttributes"

const SpacerBlock: React.FC<BlockRendererProps<SpacerAttributes>> = ({ data }) => {
  const { height, anchor } = data.attributes
  return (
    <div
      className={css`
        ${height && `height: ${height};`}
        width: 100%
      `}
      {...(anchor && { id: anchor })}
    />
  )
}

export default SpacerBlock
