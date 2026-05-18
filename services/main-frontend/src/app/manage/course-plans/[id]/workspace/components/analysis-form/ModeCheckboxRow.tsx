"use client"

import type { TFunction } from "i18next"
import type { Control } from "react-hook-form"

import {
  type AnalysisWorkspaceFormValues,
  checkboxRowStyles,
  FIELD_MODE_ASYNCHRONOUS,
  FIELD_MODE_SYNCHRONOUS,
  roleBlockStyles,
  sectionTitleStyles,
} from "./analysisFormDomain"

import { Checkbox } from "@/shared-module/components"

/**
 * Checkbox groups for mode and content-format preferences.
 */
export default function ModeCheckboxRow(props: {
  control: Control<AnalysisWorkspaceFormValues>
  t: TFunction
}) {
  const { control, t } = props
  return (
    <fieldset className={roleBlockStyles}>
      <legend className={sectionTitleStyles}>{t("course-plans-analysis-field-mode")}</legend>
      <div className={checkboxRowStyles}>
        <Checkbox
          name={FIELD_MODE_SYNCHRONOUS}
          control={control}
          label={t("course-plans-analysis-mode-synchronous")}
        />
        <Checkbox
          name={FIELD_MODE_ASYNCHRONOUS}
          control={control}
          label={t("course-plans-analysis-mode-asynchronous")}
        />
      </div>
    </fieldset>
  )
}
