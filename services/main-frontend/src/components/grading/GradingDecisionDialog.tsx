"use client"

import { css } from "@emotion/css"
import { CheckCircle, PencilEdit } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type { NewTeacherGradingDecision } from "@/generated/api/types.generated"
import { Button, Dialog } from "@/shared-module/components"

import type { GradingMode, GradingTarget } from "./gradingDecision"
import { GradingDecisionForm } from "./GradingDecisionForm"

interface GradingDecisionDialogProps {
  target: GradingTarget
  availableModes: readonly GradingMode[]
  rejectWarning?: React.ReactNode
  /** Extra content rendered at the top of the dialog, e.g. a stale-submission notice. */
  intro?: React.ReactNode
  isSubmitting?: boolean
  onSubmit: (decision: NewTeacherGradingDecision) => Promise<void>
}

const buttonRowCss = css`
  display: flex;
  gap: 0.5rem;
`

/** "Full points" instant button + a "Grade…" button opening a dialog with everything else. */
export const GradingDecisionDialog: React.FC<GradingDecisionDialogProps> = ({
  target,
  availableModes,
  rejectWarning,
  intro,
  isSubmitting = false,
  onSubmit,
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const handleSubmit = async (decision: NewTeacherGradingDecision) => {
    await onSubmit(decision)
    setOpen(false)
  }

  return (
    <div className={buttonRowCss}>
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
      <Button
        variant="secondary"
        size="medium"
        type="button"
        icon={<PencilEdit size={16} />}
        onClick={() => setOpen(true)}
      >
        {t("button-text-grade")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("label-grading-decision")}>
        {intro}
        <GradingDecisionForm
          target={target}
          availableModes={availableModes}
          rejectWarning={rejectWarning}
          // oxlint-disable-next-line i18next/no-literal-string
          layout="dialog"
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          onCancel={() => setOpen(false)}
        />
      </Dialog>
    </div>
  )
}
