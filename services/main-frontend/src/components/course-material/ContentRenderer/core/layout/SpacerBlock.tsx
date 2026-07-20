"use client"

import { css } from "@emotion/css"
import React from "react"

import type { SpacerAttributes } from "@/../types/GutenbergBlockAttributes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import type { BlockRendererProps } from "../.."

const SpacerBlock: React.FC<React.PropsWithChildren<BlockRendererProps<SpacerAttributes>>> = ({
  data,
}) => {
  const { height } = data.attributes
  return (
    <div
      className={css`
        ${height && `height: ${height};`}
        width: 100%
      `}
    />
  )
}

export default withErrorBoundary(SpacerBlock)
