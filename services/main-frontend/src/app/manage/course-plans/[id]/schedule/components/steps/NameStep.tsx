"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import { baseTheme } from "@/shared-module/common/styles"

const fieldStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;

  label {
    font-weight: 600;
    color: ${baseTheme.colors.gray[700]};
    font-size: 0.9rem;
    margin-bottom: 0.15rem;
  }

  input[type="text"] {
    padding: 0.65rem 0.85rem;
    border-radius: 10px;
    border: 1px solid ${baseTheme.colors.gray[300]};
    font-size: 1rem;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;

    :focus {
      outline: none;
      border-color: ${baseTheme.colors.green[500]};
      box-shadow: 0 0 0 3px ${baseTheme.colors.green[100]};
    }
  }
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

  return (
    <>
      <h2>{t("course-plans-wizard-step-name")}</h2>

      <div className={fieldStyles}>
        <label htmlFor="course-plan-name">{t("course-plans-plan-name-label")}</label>
        <input
          id="course-plan-name"
          type="text"
          value={planName}
          onChange={(event) => onPlanNameChange(event.target.value)}
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
