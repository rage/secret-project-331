"use client"

import React, { useState } from "react"

import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { Button } from "@/shared-module/components"

import { ReasonConfirmDialog } from "./ReasonConfirmDialog"

type ToastOptions = Parameters<typeof useToastMutation>[1]

interface UseReasonConfirmActionOptions {
  mutationFn: (fields: { reason: string }) => Promise<unknown>
  /** Runs after the mutation succeeds, e.g. to invalidate the queries the caller reads. */
  invalidate: () => void
  buttonLabel: string
  dialogTitle: string
  dialogMessage?: string
  reasonDescription?: string
  buttonVariant?: "primary" | "secondary" | "tertiary"
  toastOptions?: ToastOptions
}

interface ReasonConfirmAction {
  button: React.ReactNode
  dialog: React.ReactNode
}

/** The button + reason-confirm dialog + mutation wiring shared by one-off admin actions like unlink and materialize. */
export function useReasonConfirmAction({
  mutationFn,
  invalidate,
  buttonLabel,
  dialogTitle,
  dialogMessage,
  reasonDescription,
  buttonVariant = "tertiary",
  toastOptions = { notify: true, method: "POST" },
}: UseReasonConfirmActionOptions): ReasonConfirmAction {
  const [open, setOpen] = useState(false)

  const mutation = useToastMutation(mutationFn, toastOptions, {
    onSuccess: () => {
      setOpen(false)
      invalidate()
    },
  })

  const button = (
    <Button variant={buttonVariant} size="medium" onClick={() => setOpen(true)}>
      {buttonLabel}
    </Button>
  )

  const dialog = (
    <ReasonConfirmDialog
      open={open}
      onClose={() => setOpen(false)}
      title={dialogTitle}
      {...includeIf(dialogMessage, { message: dialogMessage })}
      {...includeIf(reasonDescription, { reasonDescription })}
      isPending={mutation.isPending}
      onConfirm={(reason) => mutation.mutate({ reason })}
    />
  )

  return { button, dialog }
}
