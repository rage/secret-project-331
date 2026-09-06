"use client"

import React, { useState } from "react"

import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import type { MenuItemDescriptor } from "@/shared-module/components"
import { Button } from "@/shared-module/components"

import { ReasonConfirmDialog } from "./ReasonConfirmDialog"

const DESTRUCTIVE_TONE = "destructive" as const

interface UseReasonConfirmActionOptions {
  mutationFn: (fields: { reason: string }) => Promise<unknown>
  /** Runs after the mutation succeeds, e.g. to invalidate the queries the caller reads. */
  invalidate: () => void
  buttonLabel: string
  dialogTitle: string
  /** One sentence saying what confirming does. */
  dialogMessage: string
  /** Danger palette for an action that cannot be taken back. */
  isDestructive?: boolean
  buttonVariant?: "primary" | "secondary" | "tertiary"
}

interface ReasonConfirmAction {
  button: React.ReactNode
  /** The same action for a row's overflow menu, where a button of its own would be too loud. */
  item: MenuItemDescriptor
  dialog: React.ReactNode
}

/** The button + reason-confirm dialog + mutation wiring shared by one-off admin actions like unlink and materialize. */
export function useReasonConfirmAction({
  mutationFn,
  invalidate,
  buttonLabel,
  dialogTitle,
  dialogMessage,
  isDestructive = false,
  buttonVariant = "tertiary",
}: UseReasonConfirmActionOptions): ReasonConfirmAction {
  const [open, setOpen] = useState(false)

  const mutation = useToastMutation(
    mutationFn,
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        setOpen(false)
        invalidate()
      },
    },
  )

  const button = (
    <Button variant={buttonVariant} size="medium" onClick={() => setOpen(true)}>
      {buttonLabel}
    </Button>
  )

  const item: MenuItemDescriptor = {
    key: buttonLabel,
    label: buttonLabel,
    isDisabled: mutation.isPending,
    onAction: () => setOpen(true),
    ...(isDestructive ? { tone: DESTRUCTIVE_TONE } : {}),
  }

  const dialog = (
    <ReasonConfirmDialog
      open={open}
      onClose={() => setOpen(false)}
      title={dialogTitle}
      description={dialogMessage}
      confirmLabel={buttonLabel}
      isDestructive={isDestructive}
      isPending={mutation.isPending}
      onConfirm={(reason) => mutation.mutate({ reason })}
    />
  )

  return { button, item, dialog }
}
