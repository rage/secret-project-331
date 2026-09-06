"use client"

import { css, cx } from "@emotion/css"
import React, { useState } from "react"
import type { Control, FieldValues } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { ButtonVariant, DialogAction } from "@/shared-module/components"
import { Button, Dialog } from "@/shared-module/components"

import { BUTTON_DESTRUCTIVE, BUTTON_PRIMARY, BUTTON_TERTIARY } from "../constants"
import { dialogFormCss, dialogFormStartCss, proseCss } from "../styles"
import { useActionResult } from "../useActionResult"
import { useReasonRequiredForm } from "./ReasonConfirmDialog"
import type { WithReason } from "./ReasonConfirmDialog"

// A field's floating-label band eats into the grid gap above it, so the description reads closer
// to the field than the form's other gaps; this makes up the difference.
const descriptionCss = css`
  margin-bottom: var(--space-2);
`

interface AdminActionDialogProps<Fields extends FieldValues & WithReason, Result> {
  triggerLabel: string
  triggerDisabled?: boolean
  /** Lower it to `tertiary` where the action must not read as the row's obvious next step. */
  triggerVariant?: ButtonVariant
  dialogTitle: string
  /** One sentence saying what confirming does, above the fields. */
  description: React.ReactNode
  /** Verb phrase naming the action, e.g. "Send to Sisu again". */
  confirmLabel: string
  /** Danger palette for an action that cannot be taken back. */
  isDestructive?: boolean
  defaultValues: Fields
  mutationFn: (fields: Fields) => Promise<Result>
  onSuccess?: (result: Result) => void
  renderFields: (control: Control<Fields>) => React.ReactNode
  renderResult: (result: Result) => React.ReactNode
}

/**
 * The shell every admin action dialog shares: a trigger button, a result banner from the last
 * run, and a form dialog with Cancel beside a primary action named after what it does.
 * `renderFields`/`renderResult` supply what differs per action.
 */
export function AdminActionDialog<Fields extends FieldValues & WithReason, Result>({
  triggerLabel,
  triggerDisabled,
  triggerVariant = "secondary",
  dialogTitle,
  description,
  confirmLabel,
  isDestructive = false,
  defaultValues,
  mutationFn,
  onSuccess,
  renderFields,
  renderResult,
}: AdminActionDialogProps<Fields, Result>) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { control, handleSubmit } = useReasonRequiredForm<Fields>(defaultValues)

  const { result, mutation } = useActionResult(mutationFn, (data) => {
    setOpen(false)
    onSuccess?.(data)
  })

  const submit = handleSubmit((fields) => mutation.mutate(fields))
  const actions: readonly [DialogAction, DialogAction] = [
    {
      label: t("button-text-cancel"),
      variant: BUTTON_TERTIARY,
      disabled: mutation.isPending,
      onPress: () => setOpen(false),
    },
    {
      label: confirmLabel,
      variant: isDestructive ? BUTTON_DESTRUCTIVE : BUTTON_PRIMARY,
      isLoading: mutation.isPending,
      onPress: () => void submit(),
    },
  ]

  return (
    <div className={dialogFormStartCss}>
      <Button
        variant={triggerVariant}
        size="medium"
        disabled={triggerDisabled ?? false}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>
      {result && renderResult(result)}
      <Dialog open={open} onClose={() => setOpen(false)} title={dialogTitle} actions={actions}>
        <form className={dialogFormCss} onSubmit={submit}>
          <p className={cx(proseCss, descriptionCss)}>{description}</p>
          {renderFields(control)}
        </form>
      </Dialog>
    </div>
  )
}
