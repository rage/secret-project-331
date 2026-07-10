"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { useWizardTextField } from "../../hooks/useWizardStepFields"

import { baseTheme } from "@/shared-module/common/styles"
import { Button, TextField } from "@/shared-module/components"

const fieldStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
`

const hintStyles = css`
  margin-top: 0.75rem;
  color: ${baseTheme.colors.gray[500]};
  font-size: 0.9rem;
`

const wizardNavStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
`

interface NameStepProps {
  planName: string
  onPlanNameChange: (value: string) => void
  onContinue: () => void
}

export default function NameStep({ planName, onPlanNameChange, onContinue }: NameStepProps) {
  const { t } = useTranslation()
  // oxlint-disable-next-line i18next/no-literal-string
  const { control, fieldName } = useWizardTextField("planName", planName, onPlanNameChange)

  return (
    <>
      <h2>{t("course-plans-wizard-step-name")}</h2>

      <div className={fieldStyles}>
        <TextField
          id="course-plan-name"
          name={fieldName}
          control={control}
          label={t("course-plans-plan-name-label")}
          placeholder={t("course-plans-untitled-plan")}
        />
      </div>

      <p className={hintStyles}>{t("course-plans-wizard-name-hint")}</p>

      <div className={wizardNavStyles}>
        <Button variant="primary" size="medium" onClick={onContinue}>
          {t("continue")}
        </Button>
      </div>
    </>
  )
}
