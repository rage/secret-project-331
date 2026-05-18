"use client"

import type { TFunction } from "i18next"
import type { Control } from "react-hook-form"

import {
  type AnalysisWorkspaceFormValues,
  checkboxRowStyles,
  CONTENT_FORMAT_FIELDS,
  roleBlockStyles,
  sectionTitleStyles,
} from "./analysisFormDomain"

import { Checkbox } from "@/shared-module/components"

/**
 * Content format checkboxes.
 */
export default function ContentFormatCheckboxes(props: {
  control: Control<AnalysisWorkspaceFormValues>
  t: TFunction
}) {
  const { control, t } = props
  return (
    <fieldset className={roleBlockStyles}>
      <legend className={sectionTitleStyles}>
        {t("course-plans-analysis-field-content-format")}
      </legend>
      <div className={checkboxRowStyles}>
        {CONTENT_FORMAT_FIELDS.map(([name, labelKey]) => (
          <Checkbox key={name} name={name} control={control} label={t(labelKey)} />
        ))}
      </div>
    </fieldset>
  )
}
