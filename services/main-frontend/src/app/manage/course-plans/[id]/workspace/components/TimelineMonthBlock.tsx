"use client"

import { css } from "@emotion/css"
import {
  Berries,
  Cabin,
  Campfire,
  CandleLight,
  Leaf,
  MapleLeaf,
  MistyCloud,
  PineTree,
  Sleigh,
  Sunrise,
  WaterLiquid,
  WinterSnowflake,
} from "@vectopus/atlas-icons-react"
import { format } from "date-fns"

import { type StageMonth } from "../../schedule/scheduleMappers"

import { baseTheme } from "@/shared-module/common/styles"

const MONTH_ICONS = [
  WinterSnowflake,
  Sleigh,
  Sunrise,
  WaterLiquid,
  Leaf,
  Campfire,
  Cabin,
  Berries,
  MapleLeaf,
  MistyCloud,
  CandleLight,
  PineTree,
] as const

const timelineMonthBlockStyles = css`
  min-width: 84px;
  border-radius: 12px;
  border: 1px solid ${baseTheme.colors.gray[200]};
  background: ${baseTheme.colors.primary[100]};
  padding: 0.6rem 0.65rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
`

const timelineMonthBlockMonthStyles = css`
  font-size: 0.78rem;
  font-weight: 700;
  color: ${baseTheme.colors.gray[600]};
  line-height: 1.1;
`

const timelineMonthBlockYearStyles = css`
  font-size: 0.72rem;
  color: ${baseTheme.colors.gray[400]};
  line-height: 1.1;
`

const timelineMonthBlockIconStyles = css`
  width: 18px;
  height: 18px;
  color: ${baseTheme.colors.green[600]};
  display: flex;
  align-items: center;
  justify-content: center;
`

interface TimelineMonthBlockProps {
  month: StageMonth
}

export default function TimelineMonthBlock({ month }: TimelineMonthBlockProps) {
  const MonthIcon = MONTH_ICONS[month.date.getMonth()]

  return (
    <div className={timelineMonthBlockStyles} title={month.label}>
      <div className={timelineMonthBlockIconStyles}>
        <MonthIcon />
      </div>
      <span className={timelineMonthBlockMonthStyles}>{format(month.date, "MMMM")}</span>
      <span className={timelineMonthBlockYearStyles}>{format(month.date, "yyyy")}</span>
    </div>
  )
}
