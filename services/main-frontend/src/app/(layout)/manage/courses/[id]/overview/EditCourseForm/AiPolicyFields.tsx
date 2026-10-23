"use client"

import styled from "@emotion/styled"
import type { TFunction } from "i18next"
import React from "react"
import { useController, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { CourseAiPolicy } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { Radio, RadioGroup } from "@/shared-module/components"

import type { EditCourseFormValues } from "."

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

const AI_POLICIES: CourseAiPolicy[] = [
  "NotSet",
  "NoAi",
  "PlanningOnly",
  "Limited",
  "FullUse",
  "Required",
]

/** The label of an AI policy option in the course settings. */
export function aiPolicyLabel(policy: CourseAiPolicy, t: TFunction): string {
  const labels: Record<CourseAiPolicy, string> = {
    NotSet: t("ai-policy-option-not-set"),
    NoAi: t("ai-policy-option-no-ai"),
    PlanningOnly: t("ai-policy-option-planning-only"),
    Limited: t("ai-policy-option-limited"),
    FullUse: t("ai-policy-option-full-use"),
    Required: t("ai-policy-option-required"),
  }
  return labels[policy]
}

const AiPolicyFields = (): React.ReactElement => {
  const { t } = useTranslation()
  const { control } = useFormContext<EditCourseFormValues>()
  // oxlint-disable-next-line i18next/no-literal-string
  const { field } = useController({ name: "course_material_ai_instructions", control })

  return (
    <>
      <FieldSet>
        <Legend>{t("course-material-ai-instructions-label")}</Legend>
        <HelpText>{t("course-material-ai-instructions-help")}</HelpText>
        <Radio
          label={t("course-material-ai-instructions-option-unknown")}
          name={field.name}
          checked={field.value === null || field.value === undefined}
          onChange={() => field.onChange(null)}
        />
        <Radio
          label={t("course-material-ai-instructions-option-yes")}
          name={field.name}
          checked={field.value === true}
          onChange={() => field.onChange(true)}
        />
        <Radio
          label={t("course-material-ai-instructions-option-no")}
          name={field.name}
          checked={field.value === false}
          onChange={() => field.onChange(false)}
        />
      </FieldSet>
      <FieldSet>
        <RadioGroup
          name="ai_policy"
          control={control}
          label={t("ai-policy-label")}
          description={t("ai-policy-help")}
        >
          {AI_POLICIES.map((policy) => (
            <Radio key={policy} label={aiPolicyLabel(policy, t)} value={policy} />
          ))}
        </RadioGroup>
      </FieldSet>
    </>
  )
}

export default AiPolicyFields
