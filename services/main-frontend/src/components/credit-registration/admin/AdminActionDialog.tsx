"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import type { Control, FieldValues, Path } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button, Dialog } from "@/shared-module/components"

import { useActionResult } from "../useActionResult"
import { isReasonConfirmDisabled, useReasonRequiredForm } from "./ReasonConfirmDialog"
import type { WithReason } from "./ReasonConfirmDialog"

const formCss = css`
  display: grid;
  gap: 0.75rem;
`

const rootCss = css`
  display: grid;
  gap: 0.75rem;
  justify-items: start;
`

interface AdminActionDialogProps<Fields extends FieldValues & WithReason, Result> {
  triggerLabel: string
  triggerDisabled?: boolean
  dialogTitle: string
  defaultValues: Fields
  mutationFn: (fields: Fields) => Promise<Result>
  onSuccess?: (result: Result, fields: Fields) => void
  renderFields: (control: Control<Fields>) => React.ReactNode
  /** `fields` is what the confirmed submission sent, e.g. to phrase the result around a chosen target. */
  renderResult: (result: Result, fields: Fields) => React.ReactNode
}

/**
 * The shell every admin bulk-action dialog shares: a trigger button, a result banner from the last
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
  const [submittedFields, setSubmittedFields] = useState<Fields | null>(null)
  const { control, handleSubmit, watch } = useReasonRequiredForm<Fields>(defaultValues)
  const reason = watch("reason" as Path<Fields>) as string

  const { result, mutation } = useActionResult(mutationFn, (data, fields) => {
    setOpen(false)
    setSubmittedFields(fields)
    onSuccess?.(data, fields)
  })

  return (
    <div className={rootCss}>
      <Button
        variant="secondary"
        size="medium"
        disabled={triggerDisabled ?? false}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>
      {result && submittedFields && renderResult(result, submittedFields)}
      <Dialog open={open} onClose={() => setOpen(false)} title={dialogTitle}>
        <form className={formCss} onSubmit={handleSubmit((fields) => mutation.mutate(fields))}>
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
