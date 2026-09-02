"use client"

import type { Control, FieldValues, Path } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { AdminCreditRegistrationAction } from "@/generated/api/types.generated"
import { Select } from "@/shared-module/components"

// oxlint-disable-next-line i18next/no-literal-string
export const READY_TO_SUBMIT = "ready_to_submit" as const
// oxlint-disable-next-line i18next/no-literal-string
export const CANCELLED = "cancelled" as const
// oxlint-disable-next-line i18next/no-literal-string
export const CLEAR_ATTENTION = "clear_needs_admin_attention" as const
// oxlint-disable-next-line i18next/no-literal-string
export const CHECK_NOW = "check_now" as const
// oxlint-disable-next-line i18next/no-literal-string
const STATE_MOVE = "state_move" as const

/** A dropdown carries one flat value, so the tagged shape the endpoint wants is rebuilt on submit. */
export type TransitionChoice =
  | typeof READY_TO_SUBMIT
  | typeof CANCELLED
  | typeof CLEAR_ATTENTION
  | typeof CHECK_NOW

export const transitionAction = (choice: TransitionChoice): AdminCreditRegistrationAction =>
  choice === CLEAR_ATTENTION || choice === CHECK_NOW
    ? { kind: choice }
    : { kind: STATE_MOVE, to_state: choice }

interface TransitionFields extends FieldValues {
  action: TransitionChoice
}

interface TransitionTargetSelectProps<T extends TransitionFields> {
  control: Control<T>
}

/** The four transition targets an admin can pick, shared by the single-item and bulk dialogs. */
export function TransitionTargetSelect<T extends TransitionFields>({
  control,
}: TransitionTargetSelectProps<T>) {
  const { t } = useTranslation()
  return (
    <Select
      name={"action" as Path<T>}
      control={control}
      label={t("label-credit-registration-transition-target")}
      options={[
        { value: READY_TO_SUBMIT, label: t("credit-registration-admin-target-resubmit") },
        { value: CANCELLED, label: t("credit-registration-admin-target-cancel") },
        { value: CLEAR_ATTENTION, label: t("credit-registration-admin-target-clear-attention") },
        { value: CHECK_NOW, label: t("credit-registration-admin-target-check-now") },
      ]}
    />
  )
}
