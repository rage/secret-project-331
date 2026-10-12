"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { CREDIT_REGISTRATION_NS } from "../constants"
import FacetChip from "./FacetChip"
import { HISTORY_RANGES } from "./historyChart"

const rangeChipsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
`

/** How many days of daily snapshots a history chart covers. */
const HistoryRangeChips: React.FC<{ days: number; onChange: (days: number) => void }> = ({
  days,
  onChange,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)

  return (
    <div
      className={rangeChipsCss}
      role="group"
      aria-label={t("credit-registration-admin-history-length")}
    >
      {HISTORY_RANGES.map((range) => (
        <FacetChip
          key={range.days}
          label={t(range.labelKey)}
          isSelected={range.days === days}
          onToggle={() => onChange(range.days)}
        />
      ))}
    </div>
  )
}

export default HistoryRangeChips
