import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import { baseTheme } from "@/shared-module/common/styles"

type ResetFilterProps = {
  threshold: number | null
  setThreshold: (val: number | null) => void
  resetAllBelowMaxPoints: boolean
  setResetAllBelowMaxPoints: (val: boolean) => void
  resetOnlyLockedPeerReviews: boolean
  setResetOnlyLockedPeerReviews: (val: boolean) => void
}

const ResetFilter: React.FC<ResetFilterProps> = ({
  threshold,
  setThreshold,
  resetAllBelowMaxPoints,
  setResetAllBelowMaxPoints,
  resetOnlyLockedPeerReviews,
  setResetOnlyLockedPeerReviews,
}) => {
  const { t } = useTranslation()
  const [thresholdCheckBox, setThresholdCheckBox] = useState(false)

  return (
    <div>
      <div
        className={css`
          padding-bottom: 10px;
          display: flex;
          align-items: baseline;
          gap: 4px;
        `}
      >
        <CheckBox
          label={t("label-only-reset-if-less-than")}
          checked={thresholdCheckBox}
          onChange={(e) => {
            setThresholdCheckBox(e.target.checked)
          }}
        />
        <input
          id="pointsThreshold"
          type="number"
          min="0"
          className={css`
            width: 5rem;
          `}
          value={threshold ?? ""}
          aria-label={t("label-only-reset-if-less-than")}
          step="1"
          disabled={!thresholdCheckBox}
          onChange={(e) => {
            let value = e.target.value === "" ? null : Number(e.target.value)
            // Ensure value is non-negative integer if present
            if (value !== null && (isNaN(value) || value < 0)) {
              value = 0
            }
            setThreshold(value)
          }}
        />
        <p> {t("label-points").toLowerCase()}</p>
      </div>
      <CheckBox
        label={t("label-reset-only-if-less-than-max-points")}
        className={css`
          padding-bottom: 10px;
          font-size: ${baseTheme.fontSizes[0]}px;
        `}
        checked={resetAllBelowMaxPoints}
        onChange={(e) => {
          setResetAllBelowMaxPoints(e.target.checked)
        }}
      />
      <CheckBox
        label={t("label-reset-only-if-reviewedAndLocked")}
        className={css`
          padding-bottom: 10px;
          font-size: ${baseTheme.fontSizes[0]}px;
        `}
        checked={resetOnlyLockedPeerReviews}
        onChange={(e) => {
          setResetOnlyLockedPeerReviews(e.target.checked)
        }}
      />
    </div>
  )
}

export default ResetFilter
