import { css } from "@emotion/css"
import { EChartsOption } from "echarts/types/src/export/option"
import dynamic from "next/dynamic"
import React from "react"

const ChartLoading = <div>Loading chart library...</div>

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => ChartLoading,
})

console.log("test")
export interface EchartsProps {
  options: EChartsOption
  height?: number
}

const Echarts: React.FC<EchartsProps> = ({ options, height = 300 }) => {
  return (
    <div>
      {/* eslint-disable-next-line react/forbid-component-props */}
      <ReactECharts style={{ height }} option={options} />
    </div>
  )
}

export default Echarts
