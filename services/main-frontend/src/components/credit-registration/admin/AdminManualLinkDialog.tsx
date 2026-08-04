"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  getAccountLinkingStatsQueryKey,
  getCreditRegistrationOverviewQueryKey,
  listCreditRegistrationsForAdminQueryKey,
  listVerifiedStudentNumbersForAdminQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  adminManuallyLinkStudentNumber,
  adminResolveStudentNumberForLinking,
} from "@/generated/api/sdk.generated"
import type {
  AdminManuallyLinkStudentNumberResult,
  AdminResolveStudentNumberResult,
} from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import {
  Button,
  Checkbox,
  DescriptionList,
  Dialog,
  Infobox,
  TextArea,
  TextField,
} from "@/shared-module/components"

import { manualLinkOutcomeLabel, sendStatusLabel } from "./adminCreditRegistrationCopy"
import RelativeTime, { ABSENT } from "./RelativeTime"

interface Props {
  open: boolean
  onClose: () => void
  studentNumber: string
}

interface Fields {
  student_number: string
  user_id: string
  resending_cannot_work: boolean
  reason: string
}

// oxlint-disable-next-line i18next/no-literal-string
const LINKED = "linked"
// oxlint-disable-next-line i18next/no-literal-string
const INFO_TONE = "info" as const
// oxlint-disable-next-line i18next/no-literal-string
const WARNING_TONE = "warning" as const
// oxlint-disable-next-line i18next/no-literal-string
const STACKED = "stacked" as const
/** Separator between identifiers on one line. Not prose, so not translated. */
// oxlint-disable-next-line i18next/no-literal-string
const DOT = " · "

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

const noteCss = css`
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
  margin: 0;
`

/**
 * Linking a student number on an admin's judgement. The last resort, and built to steer away from
 * itself.
 *
 * Two gates the API enforces as well, so a crafted request cannot skip either: the preview has to have
 * run, and the confirm echoes back the person id it returned, so a typo cannot mint a link to somebody
 * else; and a reason is required and is stored on the resulting row forever alongside
 * `verified_via = admin_manual`.
 */
const AdminManualLinkDialog: React.FC<Props> = ({ open, onClose, studentNumber }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [preview, setPreview] = useState<AdminResolveStudentNumberResult | null>(null)
  const [result, setResult] = useState<AdminManuallyLinkStudentNumberResult | null>(null)
  const { control, handleSubmit, watch } = useForm<Fields>({
    defaultValues: {
      student_number: studentNumber,
      user_id: "",
      resending_cannot_work: false,
      reason: "",
    },
  })
  const fields = watch()

  const previewMutation = useToastMutation(
    (number: string) => adminResolveStudentNumberForLinking({ body: { student_number: number } }),
    { notify: false },
    { onSuccess: setPreview },
  )
  const linkMutation = useToastMutation(
    (values: Fields) =>
      adminManuallyLinkStudentNumber({
        body: {
          user_id: values.user_id.trim(),
          student_number: values.student_number.trim(),
          // Echoed from the preview; the endpoint re-resolves and refuses if it no longer matches.
          sisu_person_id: preview?.sisu_person_id ?? "",
          reason: values.reason,
        },
      }),
    { notify: false },
    {
      onSuccess: (data) => {
        setResult(data)
        // Linking a number resolves waiting registrations synchronously, so their state and the
        // aggregates over it can change too, not just the number itself.
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: listVerifiedStudentNumbersForAdminQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getAccountLinkingStatsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: listCreditRegistrationsForAdminQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getCreditRegistrationOverviewQueryKey() }),
        ])
      },
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
        <Infobox tone={WARNING_TONE}>{t("credit-registration-admin-manual-link-warning")}</Infobox>
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
          <Infobox tone={preview.found ? INFO_TONE : WARNING_TONE}>
            {preview.study_registry_unavailable ? (
              t("credit-registration-admin-manual-link-registry-unavailable")
            ) : preview.found ? (
              <DescriptionList
                layout={STACKED}
                items={[
                  {
                    label: t("label-name"),
                    value: `${preview.first_names ?? ABSENT} ${preview.last_name ?? ABSENT}`,
                  },
                  {
                    label: t("label-credit-registration-person-id"),
                    value: <code>{preview.sisu_person_id ?? ABSENT}</code>,
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
                              {DOT}
                              {sendStatusLabel(t, mail.send_status.email_send_status)}
                              {DOT}
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
          <TextArea
            name="reason"
            control={control}
            label={t("label-reason")}
            description={t("credit-registration-admin-manual-link-reason-description")}
            rules={{ required: t("required-field") }}
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
          <Infobox tone={result.outcome === LINKED ? INFO_TONE : WARNING_TONE}>
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
