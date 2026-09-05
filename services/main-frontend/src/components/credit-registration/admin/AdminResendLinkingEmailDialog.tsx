"use client"

import { css, cx } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  getAccountLinkingStatsQueryKey,
  listCreditRegistrationsForAdminQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { adminResendAccountLinkingEmail } from "@/generated/api/sdk.generated"
import { Button, Checkbox, Dialog, Infobox } from "@/shared-module/components"

import { MIDDLE_DOT, TONE } from "../constants"
import { RESEND_QUEUED } from "../resendOutcome"
import { dialogFormCss } from "../styles"
import { useActionResult } from "../useActionResult"
import { resendOutcomeLabel, sendStatusLabel } from "./adminCreditRegistrationCopy"
import { ReasonField, isReasonConfirmDisabled, useReasonRequiredForm } from "./ReasonConfirmDialog"

interface Props {
  studentNumber: string
  courseId: string
  courseName: string
}

interface Fields {
  override_rate_caps: boolean
  reason: string
}

const rootCss = cx(
  dialogFormCss,
  css`
    justify-items: start;
  `,
)

/** The override retires the rows the caps count rather than relaxing a cap, and needs a reason. */
const AdminResendLinkingEmailDialog: React.FC<Props> = ({
  studentNumber,
  courseId,
  courseName,
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const { control, handleSubmit, watch } = useReasonRequiredForm<Fields>({
    override_rate_caps: false,
    reason: "",
  })
  const override = watch("override_rate_caps")
  const reason = watch("reason")

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
    setOpen(false)
    if (result) {
      // Deferred to close, not fired from onSuccess: a resend that lifts this row out of the
      // stale-addresses table it's rendered in would otherwise unmount the dialog — and the
      // outcome it's showing — the moment the refetch lands.
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: getAccountLinkingStatsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: listCreditRegistrationsForAdminQueryKey() }),
      ])
    }
  }

  return (
    <div className={rootCss}>
      <Button
        variant="secondary"
        size="medium"
        onClick={() => {
          setResult(null)
          setOpen(true)
        }}
      >
        {t("button-text-resend-linking-email")}
      </Button>
      <Dialog open={open} onClose={closeDialog} title={t("button-text-resend-linking-email")}>
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
        <form
          className={dialogFormCss}
          onSubmit={handleSubmit((fields) => mutation.mutate(fields))}
        >
          <p>
            {t("credit-registration-admin-resend-dialog-target", {
              studentNumber,
              course: courseName,
            })}
          </p>
          <p>{t("credit-registration-admin-resend-dialog-addresses-note")}</p>
          <p>{t("credit-registration-resend-address-they-can-read-hint")}</p>
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
          <Button
            variant="primary"
            size="medium"
            type="submit"
            disabled={isReasonConfirmDisabled(mutation.isPending, reason, override)}
          >
            {t("button-text-confirm")}
          </Button>
        </form>
      </Dialog>
    </div>
  )
}

export default AdminResendLinkingEmailDialog
