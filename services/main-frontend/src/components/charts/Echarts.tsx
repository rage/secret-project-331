"use client"

import { css } from "@emotion/css"
import type { EChartsOption } from "echarts"
import React from "react"

import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const ReactECharts = dynamicImport<{
  option: EChartsOption
  style?: React.CSSProperties | undefined
}>(() => import("echarts-for-react"))

export interface EchartsProps {
  options: EChartsOption
  height?: number
}

const Echarts: React.FC<React.PropsWithChildren<EchartsProps>> = ({ options, height = 300 }) => {
  return (
    <div
      className={css`
        width: 100%;
        /* echarts writes a pixel width onto its own container once initialised, and a chart in a
           grid or flex track would otherwise size the whole page by it. Contained here so no
           consumer has to wrap the chart to stop it. */
        min-width: 0;
        overflow-x: hidden;
      `}
    >
      {/* oxlint-disable-next-line react/forbid-component-props */}
      <ReactECharts style={{ height }} option={options} />
    </div>
  )
}

export default withErrorBoundary(Echarts)
