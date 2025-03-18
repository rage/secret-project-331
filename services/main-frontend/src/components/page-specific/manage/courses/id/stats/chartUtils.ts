import { format, isSameDay, isSameMonth, parseISO } from "date-fns"
import { EChartsOption } from "echarts/types/src/export/option"
import type { CallbackDataParams } from "echarts/types/src/util/types"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { CountResult } from "@/shared-module/common/bindings"

type DateFormatType = "yyyy-MM-dd" | "yyyy-MM"

interface LineChartConfig {
  data: CountResult[] | undefined
  yAxisName: string
  tooltipValueLabel: string
  dateFormat: DateFormatType
}

const DISPLAY_FORMAT_OPTIONS = {
  "yyyy-MM-dd": { dateStyle: "long" } as const,
  "yyyy-MM": { year: "numeric", month: "long" } as const,
} as const

const isCurrentPeriod = (date: Date, currentDate: Date, dateFormat: DateFormatType): boolean => {
  return dateFormat === "yyyy-MM" ? isSameMonth(date, currentDate) : isSameDay(date, currentDate)
}

export const useLineChartOptions = ({
  data: inputData,
  yAxisName,
  tooltipValueLabel,
  dateFormat,
}: LineChartConfig): EChartsOption => {
  const { t, i18n } = useTranslation()

  const data = useMemo(() => inputData ?? [], [inputData])
  const currentDate = useMemo(() => new Date(), [])

  const formattedDates = useMemo(
    () =>
      data
        .map((item) => item.period)
        .filter((period): period is string => period !== null)
        .map((period) => format(parseISO(period), dateFormat)),
    [data, dateFormat],
  )

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, DISPLAY_FORMAT_OPTIONS[dateFormat]),
    [i18n.language, dateFormat],
  )

  return useMemo(
    () => ({
      xAxis: {
        type: "category" as const,
        data: formattedDates,
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
          const period = data[dataPoint.dataIndex]?.period

          if (!period) {
            return ""
          }

          const date = parseISO(period)
          const formattedDate = dateFormatter.format(date)

          // Only show "so far" if it's the last point and it's in the current period
          const showSoFar =
            isLastPoint && period
              ? isCurrentPeriod(parseISO(period), currentDate, dateFormat)
              : false

          return `${formattedDate}: ${dataPoint.value} ${tooltipValueLabel}${
            showSoFar ? ` <b>(${t("so-far").toLowerCase()})</b>` : ""
          }`
        },
      },
    }),
    [formattedDates, yAxisName, data, dateFormatter, currentDate, dateFormat, tooltipValueLabel, t],
  )
}
