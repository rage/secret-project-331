"use client"

import { css } from "@emotion/css"
import React from "react"
import type { Control } from "react-hook-form"
import { useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"
import { Checkbox } from "@/shared-module/components"

import type { ResetFormFields } from "./ResetExercises"

interface ResetFilterProps {
  control: Control<ResetFormFields>
  threshold: number | null
  setThreshold: (val: number | null) => void
}

const ResetFilter: React.FC<ResetFilterProps> = ({ control, threshold, setThreshold }) => {
  const { t } = useTranslation()
  // oxlint-disable-next-line i18next/no-literal-string
  const thresholdCheckBox = useWatch({ control, name: "onlyResetBelowThreshold" })

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
        <Checkbox
          name="onlyResetBelowThreshold"
          control={control}
          label={t("label-only-reset-if-less-than")}
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
            if (value !== null && (isNaN(value) || value < 0)) {
              value = 0
            }
            setThreshold(value)
          }}
        />
        <p> {t("label-points-from-the-exercise").toLowerCase()}</p>
      </div>
      <Checkbox
        name="resetAllBelowMaxPoints"
        control={control}
        label={t("label-reset-only-if-less-than-max-points")}
        className={css`
          padding-bottom: 10px;
          font-size: ${baseTheme.fontSizes[0]}px;
        `}
      />
      <Checkbox
        name="resetOnlyLockedPeerReviews"
        control={control}
        label={t("label-reset-only-if-reviewedAndLocked")}
        className={css`
          padding-bottom: 10px;
          font-size: ${baseTheme.fontSizes[0]}px;
        `}
      />
    </div>
  )
}

export default ResetFilter
