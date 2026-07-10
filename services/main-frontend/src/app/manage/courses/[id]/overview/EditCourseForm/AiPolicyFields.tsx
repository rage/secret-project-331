"use client"

import styled from "@emotion/styled"
import React from "react"
import { Controller, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { EditCourseFormValues } from "."

import RadioButton from "@/shared-module/common/components/InputFields/RadioButton"
import { baseTheme } from "@/shared-module/common/styles"

const FieldSet = styled.fieldset`
  margin-bottom: 1rem;
  border: 1px solid ${baseTheme.colors.gray[200]};
  border-radius: 4px;
  padding: 0.5rem 1rem;
`

const Legend = styled.legend`
  font-weight: 600;
  padding: 0 0.25rem;
`

const HelpText = styled.p`
  margin: 0.25rem 0 0.5rem;
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[500]};
`

const AiPolicyFields = (): React.ReactElement => {
  const { t } = useTranslation()
  const { register, control } = useFormContext<EditCourseFormValues>()

  return (
    <>
      <FieldSet>
        <Legend>{t("course-material-ai-instructions-label")}</Legend>
        <HelpText>{t("course-material-ai-instructions-help")}</HelpText>
        <Controller
          name="course_material_ai_instructions"
          control={control}
          render={({ field }) => (
            <>
              <RadioButton
                label={t("course-material-ai-instructions-option-unknown")}
                name={field.name}
                checked={field.value === null || field.value === undefined}
                onChange={() => field.onChange(null)}
              />
              <RadioButton
                label={t("course-material-ai-instructions-option-yes")}
                name={field.name}
                checked={field.value === true}
                onChange={() => field.onChange(true)}
              />
              <RadioButton
                label={t("course-material-ai-instructions-option-no")}
                name={field.name}
                checked={field.value === false}
                onChange={() => field.onChange(false)}
              />
            </>
          )}
        />
      </FieldSet>
      <FieldSet>
        <Legend>{t("ai-policy-label")}</Legend>
        <HelpText>{t("ai-policy-help")}</HelpText>
        <RadioButton
          label={t("ai-policy-option-not-set")}
          value="NotSet"
          {...register("ai_policy")}
        />
        <RadioButton label={t("ai-policy-option-no-ai")} value="NoAi" {...register("ai_policy")} />
        <RadioButton
          label={t("ai-policy-option-planning-only")}
          value="PlanningOnly"
          {...register("ai_policy")}
        />
        <RadioButton
          label={t("ai-policy-option-limited")}
          value="Limited"
          {...register("ai_policy")}
        />
        <RadioButton
          label={t("ai-policy-option-full-use")}
          value="FullUse"
          {...register("ai_policy")}
        />
        <RadioButton
          label={t("ai-policy-option-required")}
          value="Required"
          {...register("ai_policy")}
        />
      </FieldSet>
    </>
  )
}

export default AiPolicyFields
