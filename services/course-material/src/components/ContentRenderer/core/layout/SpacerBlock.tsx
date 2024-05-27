import { css } from "@emotion/css"
import React from "react"

import { BlockRendererProps } from "../.."
import { SpacerAttributes } from "../../../../../types/GutenbergBlockAttributes"

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const SpacerBlock: React.FC<React.PropsWithChildren<BlockRendererProps<SpacerAttributes>>> = ({
  data,
}) => {
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

export default withErrorBoundary(SpacerBlock)
