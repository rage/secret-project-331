"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { adminResendAccountLinkingEmail } from "@/generated/api/sdk.generated"
import type { AdminResendAccountLinkingEmailResult } from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { Button, Checkbox, Dialog, Infobox, TextArea } from "@/shared-module/components"

import { resendOutcomeLabel, sendStatusLabel } from "./adminCreditRegistrationCopy"
import AdminManualLinkDialog from "./AdminManualLinkDialog"

interface Props {
  studentNumber: string
  courseId: string
  courseName: string
  /** Whether a mail has already been handed over or failed, which is what makes a manual link honest. */
  hasMailHistory: boolean
}

interface Fields {
  override_rate_caps: boolean
  reason: string
}

// oxlint-disable-next-line i18next/no-literal-string
const QUEUED = "queued"
// oxlint-disable-next-line i18next/no-literal-string
const INFO_TONE = "info" as const
// oxlint-disable-next-line i18next/no-literal-string
const WARNING_TONE = "warning" as const
/** Separator between identifiers on one line. Not prose, so not translated. */
// oxlint-disable-next-line i18next/no-literal-string
const DOT = " · "

const rootCss = css`
  display: grid;
  gap: 0.5rem;
  justify-items: start;
`

const formCss = css`
  display: grid;
  gap: 0.75rem;
`

const lastResortCss = css`
  background: none;
  border: none;
  padding: 0;
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
  text-decoration: underline;
  cursor: pointer;
`

/**
 * The first-line remedy, with the cap refusal reported as it came back.
 *
 * The override does not relax a cap: it retires the linking-mail rows the caps count, as its own
 * audited action, and then runs the same send path the worker runs. A reason is required for it, and
 * the endpoint refuses without one.
 */
const AdminResendLinkingEmailDialog: React.FC<Props> = ({
  studentNumber,
  courseId,
  courseName,
  hasMailHistory,
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [manualLinkOpen, setManualLinkOpen] = useState(false)
  const [result, setResult] = useState<AdminResendAccountLinkingEmailResult | null>(null)
  const { control, handleSubmit, watch } = useForm<Fields>({
    defaultValues: { override_rate_caps: false, reason: "" },
  })
  const override = watch("override_rate_caps")
  const reason = watch("reason")

  const mutation = useToastMutation(
    (fields: Fields) =>
      adminResendAccountLinkingEmail({
        body: {
          student_number: studentNumber,
          course_id: courseId,
          override_rate_caps: fields.override_rate_caps,
          reason: fields.reason.trim() === "" ? null : fields.reason.trim(),
        },
      }),
    { notify: false },
    {
      onSuccess: (data) => {
        setResult(data)
        setOpen(false)
        void queryClient.invalidateQueries()
      },
    },
  )

  return (
    <div className={rootCss}>
      <Button variant="secondary" size="medium" onClick={() => setOpen(true)}>
        {t("button-text-resend-linking-email")}
      </Button>
      {hasMailHistory && (
        <button
          type="button"
          className={lastResortCss}
          onClick={() => setManualLinkOpen(true)}
          aria-label={t("credit-registration-admin-manual-link-last-resort")}
        >
          {t("credit-registration-admin-manual-link-last-resort")}
        </button>
      )}
      {result && (
        <Infobox tone={result.outcome === QUEUED ? INFO_TONE : WARNING_TONE}>
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
              {DOT}
              {sendStatusLabel(t, mail.send_status.email_send_status)}
            </div>
          ))}
        </Infobox>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("button-text-resend-linking-email")}
      >
        <form className={formCss} onSubmit={handleSubmit((fields) => mutation.mutate(fields))}>
          <p>
            {t("credit-registration-admin-resend-dialog-target", {
              studentNumber,
              course: courseName,
            })}
          </p>
          <p>{t("credit-registration-admin-resend-dialog-addresses-note")}</p>
          <Checkbox
            name="override_rate_caps"
            control={control}
            label={t("credit-registration-admin-resend-override-label")}
            description={t("credit-registration-admin-resend-override-description")}
          />
          <TextArea
            name="reason"
            control={control}
            label={t("label-reason")}
            description={t("credit-registration-admin-resend-reason-description")}
            {...(override ? { rules: { required: t("required-field") } } : {})}
          />
          <Button
            variant="primary"
            size="medium"
            type="submit"
            disabled={mutation.isPending || (override && reason.trim() === "")}
          >
            {t("button-text-confirm")}
          </Button>
        </form>
      </Dialog>
      <AdminManualLinkDialog
        open={manualLinkOpen}
        onClose={() => setManualLinkOpen(false)}
        studentNumber={studentNumber}
      />
    </div>
  )
}

export default AdminResendLinkingEmailDialog
