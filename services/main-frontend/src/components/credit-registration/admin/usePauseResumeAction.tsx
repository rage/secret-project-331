"use client"

import React, { useState } from "react"

import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import type { MenuItemDescriptor } from "@/shared-module/components"

import { ReasonConfirmDialog } from "./ReasonConfirmDialog"

interface UsePauseResumeActionOptions {
  pause: (fields: { reason: string }) => Promise<unknown>
  resume: () => Promise<unknown>
  /** Runs after either mutation succeeds, e.g. to invalidate the queries the caller reads. */
  invalidate: () => void
  resumeConfirmMessage: string
  pauseActionLabel: string
  resumeActionLabel: string
  pauseDialogTitle: string
  /** The pause dialog's consequence sentence, shown above the reason field. */
  pauseReasonDescription: string
}

interface PauseResumeAction {
  pauseItem: MenuItemDescriptor
  resumeItem: MenuItemDescriptor
  dialog: React.ReactNode
}

/** The pause/resume wiring shared by the phase and course-module row menus: a resume confirm, a pause-reason dialog, and their mutations. */
export function usePauseResumeAction({
  pause,
  resume,
  invalidate,
  resumeConfirmMessage,
  pauseActionLabel,
  resumeActionLabel,
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

  const resumeItem: MenuItemDescriptor = {
    // oxlint-disable-next-line i18next/no-literal-string -- menu item identity, not user-facing text
    key: "resume",
    label: resumeActionLabel,
    isDisabled: resumeMutation.isPending,
    onAction: async () => {
      const confirmed = await confirm(resumeConfirmMessage)
      if (confirmed) {
        resumeMutation.mutate()
      }
    },
  }

  const pauseItem: MenuItemDescriptor = {
    // oxlint-disable-next-line i18next/no-literal-string -- menu item identity, not user-facing text
    key: "pause",
    label: pauseActionLabel,
    isDisabled: pauseMutation.isPending,
    onAction: () => setPauseOpen(true),
  }

  const dialog = (
    <ReasonConfirmDialog
      open={pauseOpen}
      onClose={() => setPauseOpen(false)}
      title={pauseDialogTitle}
      description={pauseReasonDescription}
      confirmLabel={pauseActionLabel}
      isPending={pauseMutation.isPending}
      onConfirm={(reason) => pauseMutation.mutate({ reason })}
    />
  )

  return { pauseItem, resumeItem, dialog }
}
