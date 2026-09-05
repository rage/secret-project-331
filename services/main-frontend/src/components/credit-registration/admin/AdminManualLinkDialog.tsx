"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  adminManuallyLinkStudentNumber,
  adminResolveStudentNumberForLinking,
} from "@/generated/api/sdk.generated"
import type {
  AdminManuallyLinkStudentNumberResult,
  AdminResolveStudentNumberResult,
} from "@/generated/api/types.generated"
import {
  Button,
  Checkbox,
  DescriptionList,
  Dialog,
  Infobox,
  RelativeTime,
  RELATIVE_TIME_ABSENT_LABEL,
  TextField,
} from "@/shared-module/components"

import { MIDDLE_DOT, STACKED, TONE } from "../constants"
import { noteCss } from "../styles"
import { useActionResult } from "../useActionResult"
import { manualLinkOutcomeLabel, sendStatusLabel } from "./adminCreditRegistrationCopy"
import { useInvalidateAfterLinkingChange } from "./adminCreditRegistrationHooks"
import { ReasonField, useReasonRequiredForm } from "./ReasonConfirmDialog"

interface Props {
  open: boolean
  onClose: () => void
  /** Seeds the lookup field; empty when the dialog is opened without a row to act on. */
  studentNumber?: string
}

interface Fields {
  student_number: string
  user_id: string
  resending_cannot_work: boolean
  reason: string
}

// oxlint-disable-next-line i18next/no-literal-string
const LINKED = "linked"

const formCss = css`
  display: grid;
  gap: 0.75rem;
`

const rowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: end;
`

/** The API enforces the same two gates: the preview must have run, and a reason is required. */
const AdminManualLinkDialog: React.FC<Props> = ({ open, onClose, studentNumber = "" }) => {
  const { t } = useTranslation()
  const invalidateAfterLinkingChange = useInvalidateAfterLinkingChange()
  const { control, handleSubmit, watch } = useReasonRequiredForm<Fields>({
    student_number: studentNumber,
    user_id: "",
    resending_cannot_work: false,
    reason: "",
  })
  const fields = watch()

  const { result: preview, mutation: previewMutation } = useActionResult<
    AdminResolveStudentNumberResult,
    string
  >((number) => adminResolveStudentNumberForLinking({ body: { student_number: number } }))
  const { result, mutation: linkMutation } = useActionResult<
    AdminManuallyLinkStudentNumberResult,
    Fields
  >(
    (values) =>
      adminManuallyLinkStudentNumber({
        body: {
          user_id: values.user_id.trim(),
          student_number: values.student_number.trim(),
          // Echoed from the preview; the endpoint re-resolves and refuses if it no longer matches.
          sisu_person_id: preview?.sisu_person_id ?? "",
          reason: values.reason,
        },
      }),
    () => {
      // Linking resolves waiting registrations synchronously, so their state changes too.
      void invalidateAfterLinkingChange()
    },
  )

  const confirmable =
    preview?.found === true &&
    preview.sisu_person_id !== null &&
    fields.user_id.trim() !== "" &&
    fields.resending_cannot_work &&
    fields.reason.trim() !== ""

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("credit-registration-admin-manual-link-title")}
      size="wide"
    >
      <div className={formCss}>
        <Infobox tone={TONE.WARNING}>{t("credit-registration-admin-manual-link-warning")}</Infobox>
        <div className={rowCss}>
          <TextField name="student_number" control={control} label={t("label-student-number")} />
          <Button
            variant="secondary"
            size="medium"
            disabled={previewMutation.isPending}
            onClick={() => previewMutation.mutate(fields.student_number.trim())}
          >
            {t("button-text-credit-registration-check-in-study-registry")}
          </Button>
        </div>
        {preview && (
          <Infobox tone={preview.found ? TONE.INFO : TONE.WARNING}>
            {preview.study_registry_unavailable ? (
              t("credit-registration-admin-manual-link-registry-unavailable")
            ) : preview.found ? (
              <DescriptionList
                layout={STACKED}
                items={[
                  {
                    label: t("label-name"),
                    value: `${preview.first_names ?? RELATIVE_TIME_ABSENT_LABEL} ${preview.last_name ?? RELATIVE_TIME_ABSENT_LABEL}`,
                  },
                  {
                    label: t("label-credit-registration-person-id"),
                    value: <code>{preview.sisu_person_id ?? RELATIVE_TIME_ABSENT_LABEL}</code>,
                  },
                  {
                    label: t("label-credit-registration-already-linked-to"),
                    value:
                      preview.already_linked_to_user_email ??
                      t("credit-registration-admin-not-linked"),
                  },
                  {
                    label: t("credit-registration-admin-send-status-header"),
                    value:
                      preview.linking_emails.length === 0 ? (
                        t("credit-registration-admin-no-mails-sent")
                      ) : (
                        <ul>
                          {preview.linking_emails.map((mail) => (
                            <li key={mail.id}>
                              {mail.emailed_to}
                              {MIDDLE_DOT}
                              {sendStatusLabel(t, mail.send_status.email_send_status)}
                              {MIDDLE_DOT}
                              <RelativeTime at={mail.send_status.sent_at ?? mail.claimed_at} />
                            </li>
                          ))}
                        </ul>
                      ),
                  },
                ]}
              />
            ) : (
              t("credit-registration-admin-manual-link-not-found")
            )}
          </Infobox>
        )}
        <p className={noteCss}>{t("credit-registration-admin-manual-link-preview-required")}</p>
        <form onSubmit={handleSubmit((values) => linkMutation.mutate(values))} className={formCss}>
          <TextField
            name="user_id"
            control={control}
            label={t("label-credit-registration-account-user-id")}
            description={t("description-credit-registration-account-user-id")}
          />
          <Checkbox
            name="resending_cannot_work"
            control={control}
            label={t("credit-registration-admin-manual-link-confirm-checkbox")}
          />
          <ReasonField
            control={control}
            description={t("credit-registration-admin-manual-link-reason-description")}
          />
          <Button
            variant="primary"
            size="medium"
            type="submit"
            disabled={!confirmable || linkMutation.isPending}
          >
            {t("credit-registration-admin-manual-link-confirm")}
          </Button>
        </form>
        {result && (
          <Infobox tone={result.outcome === LINKED ? TONE.INFO : TONE.WARNING}>
            <div>{manualLinkOutcomeLabel(t, result.outcome)}</div>
            {result.affected_registration_count > 0 && (
              <div>
                {t("credit-registration-admin-manual-link-unblocked", {
                  count: result.affected_registration_count,
                })}
              </div>
            )}
          </Infobox>
        )}
      </div>
    </Dialog>
  )
}

export default AdminManualLinkDialog
