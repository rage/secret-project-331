"use client"

import React, { useState } from "react"
import type { Control, FieldValues, Path } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button, Dialog } from "@/shared-module/components"

import { dialogFormCss, dialogFormStartCss } from "../styles"
import { useActionResult } from "../useActionResult"
import { isReasonConfirmDisabled, useReasonRequiredForm } from "./ReasonConfirmDialog"
import type { WithReason } from "./ReasonConfirmDialog"

interface AdminActionDialogProps<Fields extends FieldValues & WithReason, Result> {
  triggerLabel: string
  triggerDisabled?: boolean
  dialogTitle: string
  defaultValues: Fields
  mutationFn: (fields: Fields) => Promise<Result>
  onSuccess?: (result: Result) => void
  renderFields: (control: Control<Fields>) => React.ReactNode
  renderResult: (result: Result) => React.ReactNode
}

/**
 * The shell every admin action dialog shares: a trigger button, a result banner from the last
 * run, and a reason-gated form dialog. `renderFields`/`renderResult` supply what differs per action.
 */
export function AdminActionDialog<Fields extends FieldValues & WithReason, Result>({
  triggerLabel,
  triggerDisabled,
  dialogTitle,
  defaultValues,
  mutationFn,
  onSuccess,
  renderFields,
  renderResult,
}: AdminActionDialogProps<Fields, Result>) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { control, handleSubmit, watch } = useReasonRequiredForm<Fields>(defaultValues)
  const reason = watch("reason" as Path<Fields>) as string

  const { result, mutation } = useActionResult(mutationFn, (data) => {
    setOpen(false)
    onSuccess?.(data)
  })

  return (
    <div className={dialogFormStartCss}>
      <Button
        variant="secondary"
        size="medium"
        disabled={triggerDisabled ?? false}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>
      {result && renderResult(result)}
      <Dialog open={open} onClose={() => setOpen(false)} title={dialogTitle}>
        <form
          className={dialogFormCss}
          onSubmit={handleSubmit((fields) => mutation.mutate(fields))}
        >
          {renderFields(control)}
          <Button
            variant="primary"
            size="medium"
            type="submit"
            disabled={isReasonConfirmDisabled(mutation.isPending, reason)}
          >
            {t("button-text-confirm")}
          </Button>
        </form>
      </Dialog>
    </div>
  )
}
