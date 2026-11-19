"use client"

import { css } from "@emotion/css"
import React from "react"
import { VisuallyHidden } from "react-aria"
import type { Control } from "react-hook-form"
import { useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"
import { Checkbox, NumberField } from "@/shared-module/components"

import type { ResetFormFields } from "./ResetExercises"

interface ResetFilterProps {
  control: Control<ResetFormFields>
}

const ResetFilter: React.FC<ResetFilterProps> = ({ control }) => {
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
          isInline
        />
        <NumberField
          name="pointsThreshold"
          control={control}
          label={<VisuallyHidden>{t("label-only-reset-if-less-than")}</VisuallyHidden>}
          minValue={0}
          step={1}
          isDisabled={!thresholdCheckBox}
          className={css`
            width: 8rem;
          `}
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
