"use client"

import React, { useState } from "react"

import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { Button } from "@/shared-module/components"

import { ReasonConfirmDialog } from "./ReasonConfirmDialog"

interface UsePauseResumeActionOptions {
  pause: (fields: { reason: string }) => Promise<unknown>
  resume: () => Promise<unknown>
  /** Runs after either mutation succeeds, e.g. to invalidate the queries the caller reads. */
  invalidate: () => void
  resumeConfirmMessage: string
  pauseButtonLabel: string
  resumeButtonLabel: string
  pauseDialogTitle: string
  pauseReasonDescription: string
}

interface PauseResumeAction {
  pauseButton: React.ReactNode
  resumeButton: React.ReactNode
  dialog: React.ReactNode
}

/** The pause/resume wiring shared by the phase and course-module pause buttons: a resume confirm, a pause-reason dialog, and their mutations. */
export function usePauseResumeAction({
  pause,
  resume,
  invalidate,
  resumeConfirmMessage,
  pauseButtonLabel,
  resumeButtonLabel,
  pauseDialogTitle,
  pauseReasonDescription,
}: UsePauseResumeActionOptions): PauseResumeAction {
  const { confirm } = useDialog()
  const [pauseOpen, setPauseOpen] = useState(false)

  const pauseMutation = useToastMutation(
    pause,
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        setPauseOpen(false)
        invalidate()
      },
    },
  )
  const resumeMutation = useToastMutation(
    resume,
    { notify: true, method: "POST" },
    { onSuccess: () => invalidate() },
  )

  const resumeButton = (
    <Button
      variant="tertiary"
      size="small"
      isLoading={resumeMutation.isPending}
      onClick={async () => {
        const confirmed = await confirm(resumeConfirmMessage)
        if (confirmed) {
          resumeMutation.mutate()
        }
      }}
    >
      {resumeButtonLabel}
    </Button>
  )

  const pauseButton = (
    <Button variant="tertiary" size="small" onClick={() => setPauseOpen(true)}>
      {pauseButtonLabel}
    </Button>
  )

  const dialog = (
    <ReasonConfirmDialog
      open={pauseOpen}
      onClose={() => setPauseOpen(false)}
      title={pauseDialogTitle}
      reasonDescription={pauseReasonDescription}
      isPending={pauseMutation.isPending}
      onConfirm={(reason) => pauseMutation.mutate({ reason })}
    />
  )

  return { pauseButton, resumeButton, dialog }
}
