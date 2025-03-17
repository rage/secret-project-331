import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"

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

  return (
    <div>
      <div
        className={css`
          padding-bottom: 1rem;
        `}
      >
        <label htmlFor="pointsThreshold">{t("label-only-reset-if-less-than")} </label>
        <input
          id="pointsThreshold"
          type="number"
          min="0"
          value={threshold ?? ""}
          onChange={(e) => {
            const value = e.target.value === "" ? null : Number(e.target.value)
            setThreshold(value)
          }}
        />

        <span> {t("label-points").toLowerCase()}</span>
      </div>
      <CheckBox
        label={t("label-reset-only-if-less-than-max-points")}
        checked={resetAllBelowMaxPoints ?? false}
        onChange={(e) => {
          setResetAllBelowMaxPoints(e.target.checked)
        }}
      />
      <CheckBox
        label={t("label-reset-only-if-reviewedAndLocked")}
        checked={resetOnlyLockedPeerReviews ?? false}
        onChange={(e) => {
          setResetOnlyLockedPeerReviews(e.target.checked)
        }}
      />
    </div>
  )
}

export default ResetFilter
