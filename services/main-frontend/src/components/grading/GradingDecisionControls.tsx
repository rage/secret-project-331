"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { NewTeacherGradingDecision } from "@/generated/api/types.generated"

import type { GradingTarget } from "./gradingDecision"
import { GradingDecisionForm } from "./GradingDecisionForm"

interface GradingDecisionControlsProps {
  target: GradingTarget
  canResetExercise: boolean
  rejectWarning?: React.ReactNode
  isSubmitting?: boolean
  onSubmit: (decision: NewTeacherGradingDecision) => void
}

const rootCss = css`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`

const headingCss = css`
  color: var(--color-gray-700);
  margin: 0;
  font-size: var(--font-size-3);
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-gray-100);
`

/** Fully inline grading controls: no popover, no dialog. Used on the manual-review list page. */
export const GradingDecisionControls: React.FC<GradingDecisionControlsProps> = ({
  target,
  canResetExercise,
  rejectWarning,
  isSubmitting = false,
  onSubmit,
}) => {
  const { t } = useTranslation()

  return (
    <div className={rootCss}>
      <h3 className={headingCss}>{t("grading")}</h3>
      <GradingDecisionForm
        target={target}
        canResetExercise={canResetExercise}
        rejectWarning={rejectWarning}
        // oxlint-disable-next-line i18next/no-literal-string
        layout="inline"
        isSubmitting={isSubmitting}
        onSubmit={onSubmit}
      />
    </div>
  )
}
