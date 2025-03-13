import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { InstructionBox, StatHeading } from "../../CourseStatsPage"
import Echarts from "../../Echarts"

import { CountResult } from "@/shared-module/common/bindings"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import SelectMenu from "@/shared-module/common/components/SelectMenu"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"

// Common constants
export const MONTHLY_PERIOD = "monthly"
export const DAILY_PERIOD = "daily"

export type Period = typeof MONTHLY_PERIOD | typeof DAILY_PERIOD

export const DAILY_DATE_FORMAT = "yyyy-MM-dd"
export const MONTHLY_DATE_FORMAT = "yyyy-MM"

interface ChartWithHeaderProps {
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
}

const ChartWithHeader: React.FC<ChartWithHeaderProps> = ({
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
}) => {
  const { t } = useTranslation()

  if (error) {
    return <ErrorBanner variant="readOnly" error={error} />
  }

  if (isLoading) {
    return <Spinner variant="medium" />
  }

  const chartOptions = {
    data,
    yAxisName,
    tooltipValueLabel,
    dateFormat,
  }

  return (
    <>
      <div
        className={css`
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        `}
      >
        <div
          className={css`
            display: flex;
            align-items: center;
            gap: 0.5rem;
          `}
        >
          <StatHeading>{statHeading}</StatHeading>
          <DebugModal
            variant="minimal"
            data={data}
            buttonWrapperStyles={css`
              display: flex;
              align-items: center;
            `}
          />
        </div>
        <SelectMenu
          id="period-select"
          options={[
            { value: MONTHLY_PERIOD, label: t("stats-period-monthly") },
            { value: DAILY_PERIOD, label: t("stats-period-daily") },
          ]}
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className={css`
            margin-bottom: 0;
            min-width: 120px;
          `}
          showDefaultOption={false}
        />
      </div>
      <InstructionBox>{instructionText}</InstructionBox>
      {!data || data.length === 0 ? (
        <div>{t("no-data")}</div>
      ) : (
        <div
          className={css`
            margin-bottom: 2rem;
            border: 3px solid ${baseTheme.colors.clear[200]};
            border-radius: 6px;
            padding: 1rem;
          `}
        >
          <Echarts options={chartOptions} height={300} />
        </div>
      )}
    </>
  )
}

export default ChartWithHeader
