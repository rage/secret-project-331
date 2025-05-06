import { css } from "@emotion/css"
import { EChartsOption } from "echarts/types/src/export/option"
import React from "react"

import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const ReactECharts = dynamicImport<{ option: EChartsOption; style?: React.CSSProperties }>(
  () => import("echarts-for-react"),
)

export interface EchartsProps {
  options: EChartsOption
  height?: number
}

const Echarts: React.FC<React.PropsWithChildren<EchartsProps>> = ({ options, height = 300 }) => {
  return (
    <div
      className={css`
        width: 100%;
      `}
    >
      {/* eslint-disable-next-line react/forbid-component-props */}
      <ReactECharts style={{ height }} option={options} />
    </div>
  )
}

export default withErrorBoundary(Echarts)
