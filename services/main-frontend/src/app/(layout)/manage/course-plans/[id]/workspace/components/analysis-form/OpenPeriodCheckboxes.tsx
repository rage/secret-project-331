"use client"

import type { TFunction } from "i18next"
import type { Control, UseFormSetValue } from "react-hook-form"
import { useWatch } from "react-hook-form"

import SelectAllCheckbox from "@/components/forms/SelectAllCheckbox"
import { Checkbox } from "@/shared-module/components"

import {
  type AnalysisWorkspaceFormValues,
  checkboxGroupStyles,
  checkboxRowStyles,
  OPEN_PERIOD_I,
  OPEN_PERIOD_II,
  OPEN_PERIOD_III,
  OPEN_PERIOD_IV,
  roleBlockStyles,
  sectionTitleStyles,
} from "./analysisFormDomain"

/**
 * Open-period checkboxes; "All" is derived from the four periods and toggles them via `setValue` (not an RHF field).
 */
export default function OpenPeriodCheckboxes(props: {
  control: Control<AnalysisWorkspaceFormValues>
  setValue: UseFormSetValue<AnalysisWorkspaceFormValues>
  t: TFunction
}) {
  const { control, setValue, t } = props

  const [p1, p2, p3, p4] = useWatch({
    control,
    name: [OPEN_PERIOD_I, OPEN_PERIOD_II, OPEN_PERIOD_III, OPEN_PERIOD_IV],
  })
  const allSelected = Boolean(p1 && p2 && p3 && p4)

  const handleToggleAll = (next: boolean) => {
    setValue(OPEN_PERIOD_I, next, { shouldDirty: true })
    setValue(OPEN_PERIOD_II, next, { shouldDirty: true })
    setValue(OPEN_PERIOD_III, next, { shouldDirty: true })
    setValue(OPEN_PERIOD_IV, next, { shouldDirty: true })
  }

  return (
    <fieldset className={roleBlockStyles}>
      <legend className={sectionTitleStyles}>
        {t("course-plans-analysis-field-open-periods")}
      </legend>
      <div className={checkboxGroupStyles}>
        <div className={checkboxRowStyles}>
          <SelectAllCheckbox
            label={t("course-plans-analysis-period-all")}
            isAllSelected={allSelected}
            onToggleAll={handleToggleAll}
          />
          <Checkbox
            name={OPEN_PERIOD_I}
            control={control}
            label={t("course-plans-analysis-period-i")}
          />
          <Checkbox
            name={OPEN_PERIOD_II}
            control={control}
            label={t("course-plans-analysis-period-ii")}
          />
          <Checkbox
            name={OPEN_PERIOD_III}
            control={control}
            label={t("course-plans-analysis-period-iii")}
          />
          <Checkbox
            name={OPEN_PERIOD_IV}
            control={control}
            label={t("course-plans-analysis-period-iv")}
          />
        </div>
      </div>
    </fieldset>
  )
}
