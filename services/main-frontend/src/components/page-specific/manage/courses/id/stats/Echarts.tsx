import { EChartsOption } from "echarts/types/src/export/option"
import dynamic from "next/dynamic"
import React from "react"

import Spinner from "../../../../../../shared-module/common/components/Spinner"
import withErrorBoundary from "../../../../../../shared-module/common/utils/withErrorBoundary"

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  // eslint-disable-next-line react/display-name
  loading: () => <Spinner variant="medium" />,
})

export interface EchartsProps {
  options: EChartsOption
  height?: number
}

const Echarts: React.FC<React.PropsWithChildren<EchartsProps>> = ({ options, height = 300 }) => {
  return (
    <div>
      {/* eslint-disable-next-line react/forbid-component-props */}
      <ReactECharts style={{ height }} option={options} />
    </div>
  )
}

export default withErrorBoundary(Echarts)
