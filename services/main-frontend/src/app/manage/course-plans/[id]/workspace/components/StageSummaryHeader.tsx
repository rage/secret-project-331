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
import { useTranslation } from "react-i18next"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

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

const stageHeaderBarStyles = css`
  display: flex;
  justify-content: flex-end;
  padding: 0 1.5rem;

  ${respondToOrLarger.xl} {
    padding: 0 3rem;
  }
`

const stageHeaderCardStyles = css`
  display: inline-flex;
  align-items: center;
  gap: 1rem;
  min-width: 22rem;
  padding: 0.85rem 1.5rem;
  border-radius: 999px;
  background: white;
  border: 1px solid ${baseTheme.colors.gray[200]};
  box-shadow: 0 12px 25px rgba(15, 23, 42, 0.08);
  cursor: pointer;
  transition:
    box-shadow 150ms ease,
    transform 150ms ease,
    border-color 150ms ease;

  :hover {
    box-shadow: 0 18px 35px rgba(15, 23, 42, 0.12);
    transform: translateY(-1px);
    border-color: ${baseTheme.colors.primary[200]};
  }

  :active {
    transform: translateY(0);
    box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
  }
`

const stageHeaderDateBlockStyles = css`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`

const stageHeaderMonthIconStyles = css`
  width: 20px;
  height: 20px;
  color: ${baseTheme.colors.green[600]};
  flex-shrink: 0;
`

const stagePillStyles = css`
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  background: ${baseTheme.colors.gray[100]};
  color: ${baseTheme.colors.gray[800]};
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
`

const stageHeaderTextStyles = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex: 1;
  min-width: 0;
`

const stageHeaderWelcomeStyles = css`
  font-size: 0.8rem;
  color: ${baseTheme.colors.gray[500]};
  margin-bottom: 0.15rem;
`

const stageHeaderPrimaryStyles = css`
  font-size: 0.95rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[900]};
`

const stageHeaderSecondaryStyles = css`
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[600]};
`

const stageHeaderDateStyles = css`
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[600]};
  white-space: nowrap;
`

export interface StageSummaryHeaderProps {
  fullDateLabel: string
  welcomeLabel: string
  monthIndex: number
  stageLabel: string
  timeRemainingLabel: string | null
  metaLabel: string | null
  onClick: () => void
}

const StageSummaryHeader: React.FC<StageSummaryHeaderProps> = ({
  fullDateLabel,
  welcomeLabel,
  monthIndex,
  stageLabel,
  timeRemainingLabel,
  metaLabel,
  onClick,
}) => {
  const MonthIcon = MONTH_ICONS[monthIndex] ?? MONTH_ICONS[0]

  return (
    <BreakFromCentered sidebar={false}>
      <div className={stageHeaderBarStyles}>
        <button
          type="button"
          onClick={onClick}
          className={stageHeaderCardStyles}
          aria-label={timeRemainingLabel ?? stageLabel}
        >
          <div className={stageHeaderDateBlockStyles}>
            <span className={stageHeaderMonthIconStyles} aria-hidden>
              <MonthIcon />
            </span>
            <span className={stageHeaderDateStyles}>{fullDateLabel}</span>
          </div>
          <div className={stageHeaderTextStyles}>
            <span className={stageHeaderWelcomeStyles}>{welcomeLabel}</span>
            <span className={stageHeaderPrimaryStyles}>{stageLabel}</span>
            {timeRemainingLabel && (
              <span className={stageHeaderSecondaryStyles}>{timeRemainingLabel}</span>
            )}
          </div>
          {metaLabel && <span className={stagePillStyles}>{metaLabel}</span>}
        </button>
      </div>
    </BreakFromCentered>
  )
}

export default StageSummaryHeader
