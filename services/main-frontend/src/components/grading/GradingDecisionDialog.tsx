"use client"

import { PencilEdit } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type { NewTeacherGradingDecision } from "@/generated/api/types.generated"
import { Button, Dialog } from "@/shared-module/components"

import type { GradingTarget } from "./gradingDecision"
import { GradingDecisionForm } from "./GradingDecisionForm"

interface GradingDecisionDialogProps {
  target: GradingTarget
  canResetExercise: boolean
  rejectWarning?: React.ReactNode
  /** Extra content rendered at the top of the dialog, e.g. a stale-submission notice. */
  intro?: React.ReactNode
  isSubmitting?: boolean
  onSubmit: (decision: NewTeacherGradingDecision) => Promise<void>
}

/** A "Grade" button opening a dialog with the grading form. Used where the form can't stay inline. */
export const GradingDecisionDialog: React.FC<GradingDecisionDialogProps> = ({
  target,
  canResetExercise,
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
    <>
      <Button
        variant="secondary"
        size="medium"
        type="button"
        icon={<PencilEdit size={16} />}
        disabled={isSubmitting}
        onClick={() => setOpen(true)}
      >
        {t("button-text-grade")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("label-grading-decision")}>
        {intro}
        <GradingDecisionForm
          target={target}
          canResetExercise={canResetExercise}
          rejectWarning={rejectWarning}
          // oxlint-disable-next-line i18next/no-literal-string
          layout="dialog"
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
        />
      </Dialog>
    </>
  )
}
