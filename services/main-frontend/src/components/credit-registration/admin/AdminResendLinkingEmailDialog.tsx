"use client"

import { useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  getAccountLinkingStatsQueryKey,
  listCreditRegistrationsForAdminQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { adminResendAccountLinkingEmail } from "@/generated/api/sdk.generated"
import type { DialogAction } from "@/shared-module/components"
import { Checkbox, Dialog, Infobox } from "@/shared-module/components"

import { BUTTON_PRIMARY, CREDIT_REGISTRATION_NS, MIDDLE_DOT, TONE } from "../constants"
import { RESEND_QUEUED } from "../resendOutcome"
import { dialogFormCss, noteCss, proseCss } from "../styles"
import { useActionResult } from "../useActionResult"
import { resendOutcomeLabel, sendStatusLabel } from "./adminCreditRegistrationCopy"
import { ReasonField, useReasonRequiredForm } from "./ReasonConfirmDialog"

interface Props {
  open: boolean
  onClose: () => void
  studentNumber: string
  courseId: string
  courseName: string
}

interface Fields {
  override_rate_caps: boolean
  reason: string
}

/**
 * Sends the account-linking mail for one person and course again.
 *
 * The override retires the mails the caps count rather than relaxing a cap, so it needs a reason;
 * an ordinary resend does not. Controlled, so a row's overflow menu can open it.
 */
const AdminResendLinkingEmailDialog: React.FC<Props> = ({
  open,
  onClose,
  studentNumber,
  courseId,
  courseName,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const queryClient = useQueryClient()
  const { control, handleSubmit, watch } = useReasonRequiredForm<Fields>({
    override_rate_caps: false,
    reason: "",
  })
  const override = watch("override_rate_caps")

  const { result, setResult, mutation } = useActionResult((fields: Fields) =>
    adminResendAccountLinkingEmail({
      body: {
        student_number: studentNumber,
        course_id: courseId,
        override_rate_caps: fields.override_rate_caps,
        reason: fields.reason.trim() === "" ? null : fields.reason.trim(),
      },
    }),
  )

  const closeDialog = () => {
    onClose()
    if (result) {
      setResult(null)
      // Deferred to close, not fired from onSuccess: a resend that lifts this row out of the
      // stale-addresses table it's rendered in would otherwise unmount the dialog — and the
      // outcome it's showing — the moment the refetch lands.
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: getAccountLinkingStatsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: listCreditRegistrationsForAdminQueryKey() }),
      ])
    }
  }

  const submit = handleSubmit((fields) => mutation.mutate(fields))
  const actions: readonly [DialogAction] = [
    {
      label: t("button-text-resend-linking-email"),
      variant: BUTTON_PRIMARY,
      isLoading: mutation.isPending,
      onPress: () => void submit(),
    },
  ]

  return (
    <Dialog
      open={open}
      onClose={closeDialog}
      title={t("button-text-resend-linking-email")}
      actions={actions}
    >
      <div className={dialogFormCss}>
        {result && (
          <Infobox tone={result.outcome === RESEND_QUEUED ? TONE.INFO : TONE.WARNING}>
            <div>{resendOutcomeLabel(t, result.outcome)}</div>
            <div>
              {t("credit-registration-admin-resend-mails-so-far", {
                sent: result.mails_sent_for_this_course,
                max: result.max_mails_per_person_and_course,
              })}
            </div>
            {result.retired_mail_count > 0 && (
              <div>
                {t("credit-registration-admin-resend-retired-mails", {
                  count: result.retired_mail_count,
                })}
              </div>
            )}
            {result.linking_emails.map((mail) => (
              <div key={mail.id}>
                {mail.emailed_to}
                {MIDDLE_DOT}
                {sendStatusLabel(t, mail.send_status.email_send_status)}
              </div>
            ))}
          </Infobox>
        )}
        <form className={dialogFormCss} onSubmit={submit}>
          <p className={proseCss}>
            {t("credit-registration-admin-resend-dialog-target", {
              studentNumber,
              course: courseName,
            })}
          </p>
          <p className={noteCss}>{t("credit-registration-admin-resend-registry-addresses-only")}</p>
          <Checkbox
            name="override_rate_caps"
            control={control}
            label={t("credit-registration-admin-resend-override-label")}
            description={t("credit-registration-admin-resend-override-description")}
          />
          <ReasonField
            control={control}
            description={t("credit-registration-admin-resend-reason-description")}
            isRequired={override}
          />
        </form>
      </div>
    </Dialog>
  )
}

export default AdminResendLinkingEmailDialog
