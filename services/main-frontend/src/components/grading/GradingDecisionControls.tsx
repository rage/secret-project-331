"use client"

import { css } from "@emotion/css"
import { CheckCircle } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import type { NewTeacherGradingDecision } from "@/generated/api/types.generated"
import { Button } from "@/shared-module/components"

import type { GradingMode, GradingTarget } from "./gradingDecision"
import { GradingDecisionForm } from "./GradingDecisionForm"

interface GradingDecisionControlsProps {
  target: GradingTarget
  availableModes: readonly GradingMode[]
  rejectWarning?: React.ReactNode
  isSubmitting?: boolean
  onSubmit: (decision: NewTeacherGradingDecision) => void
}

const rootCss = css`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`

const headerCss = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-gray-100);
`

const headingCss = css`
  color: var(--color-gray-700);
  margin: 0;
  font-size: var(--font-size-3);
`

/** Fully inline grading controls: no popover, no dialog. Used on the manual-review list page. */
export const GradingDecisionControls: React.FC<GradingDecisionControlsProps> = ({
  target,
  availableModes,
  rejectWarning,
  isSubmitting = false,
  onSubmit,
}) => {
  const { t } = useTranslation()

  return (
    <div className={rootCss}>
      <div className={headerCss}>
        <h3 className={headingCss}>{t("grading")}</h3>
        <Button
          variant="primary"
          size="medium"
          type="button"
          icon={<CheckCircle size={16} />}
          disabled={isSubmitting}
          onClick={() =>
            onSubmit({
              user_exercise_state_id: target.userExerciseStateId,
              exercise_id: target.exerciseId,
              // oxlint-disable-next-line i18next/no-literal-string
              action: "FullPoints",
              manual_points: null,
              justification: null,
              hidden: false,
            })
          }
        >
          {t("button-text-full-points")}
        </Button>
      </div>
      <GradingDecisionForm
        target={target}
        availableModes={availableModes}
        rejectWarning={rejectWarning}
        // oxlint-disable-next-line i18next/no-literal-string
        layout="inline"
        isSubmitting={isSubmitting}
        onSubmit={onSubmit}
      />
    </div>
  )
}
