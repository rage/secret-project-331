import { EChartsOption } from "echarts/types/src/export/option"
import type { CallbackDataParams } from "echarts/types/src/util/types"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

interface DataPoint {
  period: string | null
  count: number
}

interface LineChartConfig {
  data: DataPoint[]
  yAxisName: string
  tooltipValueLabel: string
}

export const useLineChartOptions = ({
  data,
  yAxisName,
  tooltipValueLabel,
}: LineChartConfig): EChartsOption => {
  const { t } = useTranslation()
  return useMemo(
    () => ({
      xAxis: {
        type: "category" as const,
        data: data.map((item) => item.period).filter((period): period is string => period !== null),
      },
      yAxis: {
        type: "value" as const,
        name: yAxisName,
      },
      series: [
        {
          data: data.map((item) => ({
            value: item.count,
          })),
          type: "line" as const,
        },
      ],
      tooltip: {
        trigger: "axis" as const,
        formatter: (params: CallbackDataParams | CallbackDataParams[]) => {
          const dataPoint = Array.isArray(params) ? params[0] : params
          const isLastPoint = dataPoint.dataIndex === data.length - 1
          return `${dataPoint.name}: ${dataPoint.value} ${tooltipValueLabel}${isLastPoint ? ` <b>(${t("so-far").toLowerCase()})</b>` : ""}`
        },
      },
    }),
    [data, yAxisName, tooltipValueLabel, t],
  )
}
