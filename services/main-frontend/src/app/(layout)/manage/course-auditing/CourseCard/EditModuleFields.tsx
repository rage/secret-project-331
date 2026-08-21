"use client"

import { css } from "@emotion/css"
import React from "react"
import { useWatch, type Control } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Checkbox, nullIfEmpty, stringToNumberOrNull, TextField } from "@/shared-module/components"

import { contentRowStyles, FieldSet, Legend } from "../page"
import type { EditCourseAuditingData, EditModuleData } from "./CourseCard"

interface Props {
  control: Control<EditCourseAuditingData>
  module: EditModuleData
  idx: number
}

const EditModuleFields: React.FC<Props> = ({ control, module, idx }) => {
  const { t } = useTranslation()

  const override = useWatch({ name: `modules.${idx}.override_completion_link` as const, control })

  return (
    <FieldSet key={module.id} data-testid="edit-module-fields">
      <Legend>
        {module.name ? `${module.order_number}. ${module.name}` : t("default-module")}
      </Legend>
      <Checkbox
        control={control}
        label={t("override-completion-registration-link")}
        name={`modules.${idx}.override_completion_link` as const}
      />
      <TextField
        control={control}
        label={t("completion-registration-link")}
        name={`modules.${idx}.completion_registration_link_override` as const}
        rules={nullIfEmpty}
        isDisabled={!override}
      />
      <Checkbox
        control={control}
        label={t("label-enable-registering-completion-to-uh-open-university")}
        name={`modules.${idx}.enable_registering_completion_to_uh_open_university` as const}
      />
      <div key={module.id} className={contentRowStyles}>
        <div
          className={css`
            flex: auto;
          `}
        >
          <TextField
            control={control}
            label={t("uh-course-code")}
            name={`modules.${idx}.uh_course_code` as const}
            rules={nullIfEmpty}
          />
        </div>
        <div
          className={css`
            flex: auto;
          `}
        >
          <TextField
            control={control}
            label={t("ects-credits")}
            name={`modules.${idx}.ects_credits` as const}
            // oxlint-disable-next-line i18next/no-literal-string
            inputMode="decimal"
            type="number"
            min={0}
            rules={{
              ...stringToNumberOrNull,
              valueAsNumber: true,
              validate: (v) => {
                return (
                  v === null ||
                  v === undefined ||
                  (typeof v === "number" && Number.isFinite(v)) ||
                  t("course-plans-analysis-error-credits-invalid")
                )
              },
            }}
          />
        </div>
      </div>
    </FieldSet>
  )
}

export default EditModuleFields
