import { css } from "@emotion/css"
import { format } from "date-fns"
import type { EChartsOption } from "echarts/types/src/export/option"
import React from "react"
import { useTranslation } from "react-i18next"

import { DEFAULT_CHART_HEIGHT, InstructionBox } from "./CourseStatsPage"
import Echarts from "./Echarts"
import StatsHeader from "./StatsHeader"

import { CountResult } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import DatePickerField from "@/shared-module/common/components/InputFields/DatePickerField"
import SelectMenu from "@/shared-module/common/components/SelectMenu"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"

export const MONTHLY_PERIOD = "Month" as const
export const DAILY_PERIOD = "Day" as const
export const CUSTOM_PERIOD = "Custom" as const

export type Period = typeof MONTHLY_PERIOD | typeof DAILY_PERIOD | typeof CUSTOM_PERIOD

export const DAILY_DATE_FORMAT = "yyyy-MM-dd"
export const MONTHLY_DATE_FORMAT = "yyyy-MM"

interface LineChartProps {
  data: CountResult[] | undefined
  isLoading: boolean
  error: Error | undefined | null
  period: Period
  setPeriod: React.Dispatch<React.SetStateAction<Period>>
  yAxisName: string
  tooltipValueLabel: string
  dateFormat: string
  statHeading: string
  instructionText: string
  disablePeriodSelector?: boolean
  showCustomTimePeriodSelector?: boolean
  startDate?: string | null
  endDate?: string | null
  setStartDate?: React.Dispatch<React.SetStateAction<string | null>>
  setEndDate?: React.Dispatch<React.SetStateAction<string | null>>
}

const LineChart: React.FC<LineChartProps> = ({
  data,
  isLoading,
  error,
  period,
  setPeriod,
  yAxisName,
  tooltipValueLabel,
  dateFormat,
  statHeading,
  instructionText,
  disablePeriodSelector = false,
  showCustomTimePeriodSelector,
  setStartDate,
  setEndDate,
}) => {
  const { t } = useTranslation()

  const chartOptions: EChartsOption = {
    xAxis: {
      type: "category" as const,
      data:
        data
          ?.map((item) => {
            if (!item.period) {
              return null
            }
            try {
              return format(new Date(item.period), dateFormat)
            } catch {
              return item.period
            }
          })
          .filter((x): x is string => x !== null) || [],
    },
    yAxis: {
      type: "value" as const,
      name: yAxisName,
    },
    series: [
      {
        data: data?.map((item) => item.count) || [],
        type: "line" as const,
      },
    ],
    tooltip: {
      // eslint-disable-next-line i18next/no-literal-string
      trigger: "axis" as const,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (params: any) => {
        const dataIndex = params[0].dataIndex as number
        const period = data?.[dataIndex].period
        const value = data?.[dataIndex].count
        try {
          const formattedDate = format(new Date(period || ""), dateFormat)
          // eslint-disable-next-line i18next/no-literal-string
          return `${formattedDate}<br/>${tooltipValueLabel}: ${value}`
        } catch {
          // eslint-disable-next-line i18next/no-literal-string
          return `${period}<br/>${tooltipValueLabel}: ${value}`
        }
      },
    },
  }

  return (
    <>
      <StatsHeader heading={statHeading} debugData={data}>
        {!disablePeriodSelector && (
          <div
            className={css`
              display: flex;
              gap: 1rem;
              align-items: center;
            `}
          >
            {showCustomTimePeriodSelector && period === CUSTOM_PERIOD && (
              <div
                className={css`
                  display: flex;
                  gap: 4px;
                  padding-bottom: 12px;
                `}
              >
                <DatePickerField
                  label={t("stats-start-date")}
                  onChangeByValue={(value) => setStartDate?.(value)}
                />
                <DatePickerField
                  label={t("stats-end-date")}
                  onChangeByValue={(value) => setEndDate?.(value)}
                />
              </div>
            )}

            <SelectMenu
              id="period-select"
              options={[
                { value: MONTHLY_PERIOD, label: t("stats-period-monthly") },
                { value: DAILY_PERIOD, label: t("stats-period-daily") },
                ...(showCustomTimePeriodSelector
                  ? [{ value: CUSTOM_PERIOD, label: t("stats-period-custom") }]
                  : []),
              ]}
              value={period}
              onChange={(e) => setPeriod(e.currentTarget.value as Period)}
              className={css`
                margin-bottom: 0;
                min-width: 120px;
              `}
              showDefaultOption={false}
            />
          </div>
        )}
      </StatsHeader>
      <InstructionBox>{instructionText}</InstructionBox>
      <div
        className={css`
          margin-bottom: 2rem;
          border: 3px solid ${baseTheme.colors.clear[200]};
          border-radius: 6px;
          padding: 1rem;
          min-height: ${DEFAULT_CHART_HEIGHT}px;
          display: flex;
          align-items: center;
          justify-content: center;
        `}
      >
        {isLoading ? (
          <Spinner variant="medium" />
        ) : error ? (
          <ErrorBanner variant="readOnly" error={error} />
        ) : !data || data.length < 2 ? (
          <div>{t("no-data")}</div>
        ) : (
          <Echarts options={chartOptions} height={DEFAULT_CHART_HEIGHT} />
        )}
      </div>
    </>
  )
}

export default LineChart
