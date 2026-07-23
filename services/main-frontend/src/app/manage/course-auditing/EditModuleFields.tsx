"use client"

import { css } from "@emotion/css"
import React from "react"
import { useWatch, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"
import { Checkbox, nullIfEmpty, TextField } from "@/shared-module/components"

import type { EditCourseAuditingData, EditModuleData } from "./CourseAuditingCard"

//use getvalues, no passing

interface Props {
  module: EditModuleData
  idx: number
}

const EditModuleFields: React.FC<Props> = ({ module, idx }) => {
  const { t } = useTranslation()
  const {
    register,
    setValue,
    getValues,
    formState: { errors },
    control,
  } = useFormContext<EditCourseAuditingData>()

  // oxlint-disable-next-line i18next/no-literal-string
  //const isClosed = useWatch({ name: "set_course_closed_at", control })

  return (
    <div
      className={css`
        display: flex;
        flex-wrap: wrap;
        flex-direction: column;
        gap: 1rem;
      `}
    >
      <div
        className={css`
          font-size: 1.15rem;
          font-weight: 600;
          color: ${baseTheme.colors.gray[900]};
          margin: 1.5rem 0rem;
        `}
      >
        {module.name ? `${module.order_number}. ${module.name}` : t("default-module")}
      </div>
      <Checkbox
        control={control}
        label={t("override-completion-registration-link")}
        name={`modules.${idx}.override_completion_link`}
      />
      <TextField
        control={control}
        label={t("completion-registration-link")}
        name={`modules.${idx}.completion_registration_link_override`}
        rules={nullIfEmpty}
      />
      <Checkbox
        control={control}
        label={t("label-enable-registering-completion-to-uh-open-university")}
        name={`modules.${idx}.enable_registering_completion_to_uh_open_university`}
      />
      <div
        className={css`
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
        `}
      >
        <TextField
          control={control}
          label={t("uh-course-code")}
          name={`modules.${idx}.uh_course_code`}
          rules={nullIfEmpty}
        />
        <TextField
          control={control}
          label={t("ects-credits")}
          name={`modules.${idx}.ects_credits`}
          rules={nullIfEmpty}
        />
      </div>
    </div>
  )
}

export default EditModuleFields
