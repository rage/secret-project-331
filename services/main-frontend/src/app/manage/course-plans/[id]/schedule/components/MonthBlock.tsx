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
import { motion } from "motion/react"
import { forwardRef } from "react"

import { StageMonth } from "../scheduleMappers"

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

const stageMonthBlockStyles = css`
  min-width: 84px;
  border-radius: 12px;
  border: 1px solid #d9dde4;
  background: white;
  padding: 0.6rem 0.65rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
`

const stageMonthBlockMonthStyles = css`
  font-size: 0.78rem;
  font-weight: 700;
  color: #415167;
  line-height: 1.1;
`

const stageMonthBlockYearStyles = css`
  font-size: 0.72rem;
  color: #6a7686;
  line-height: 1.1;
`

const stageMonthBlockIconStyles = css`
  width: 18px;
  height: 18px;
  color: #2d7b4f;
  display: flex;
  align-items: center;
  justify-content: center;
`

interface MonthBlockProps {
  month: StageMonth
  reduceMotion: boolean
  layoutId: string
}

const MonthBlock = forwardRef<HTMLDivElement, MonthBlockProps>(function MonthBlock(
  { month, reduceMotion, layoutId },
  ref,
) {
  const MonthIcon = MONTH_ICONS[month.date.getMonth()]

  return (
    <motion.div
      ref={ref}
      layout
      layoutId={layoutId}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className={stageMonthBlockStyles} title={month.label}>
        <div className={stageMonthBlockIconStyles}>
          <MonthIcon />
        </div>
        <span className={stageMonthBlockMonthStyles}>{format(month.date, "MMMM")}</span>
        <span className={stageMonthBlockYearStyles}>{format(month.date, "yyyy")}</span>
      </div>
    </motion.div>
  )
})

export default MonthBlock
