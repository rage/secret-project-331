"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  getCreditRegistrationAttentionItemsQueryKey,
  getCreditRegistrationForAdminQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { adminResendAccountLinkingEmail } from "@/generated/api/sdk.generated"
import type { AdminLinkingCandidate } from "@/generated/api/types.generated"
import type { DialogAction } from "@/shared-module/components"
import { Badge, Checkbox, Dialog, Infobox, Radio, RadioGroup } from "@/shared-module/components"

import type { CreditRegistrationTFunction } from "../constants"
import {
  BADGE_COMPACT,
  BUTTON_PRIMARY,
  CREDIT_REGISTRATION_NS,
  MIDDLE_DOT,
  TONE,
} from "../constants"
import { RESEND_QUEUED } from "../resendOutcome"
import { dialogFormCss, noteCss, proseCss, rowCss, stackedCellCss } from "../styles"
import { useActionResult } from "../useActionResult"
import { formatZonedTimestamp } from "../ZonedTimestamp"
import { linkingSimilarityLabel, resendOutcomeLabel } from "./adminCreditRegistrationCopy"
import { useLinkingCandidates } from "./adminCreditRegistrationHooks"
import { ReasonField, useReasonRequiredForm } from "./ReasonConfirmDialog"

interface Props {
  open: boolean
  onClose: () => void
  registrationId: string
}

interface Fields {
  student_number: string
  override_rate_caps: boolean
  reason: string
}

const candidateListCss = css`
  max-height: 24rem;
  overflow-y: auto;
`

const candidateName = (t: CreditRegistrationTFunction, candidate: AdminLinkingCandidate) =>
  [candidate.first_names, candidate.last_name].filter(Boolean).join(" ") ||
  t("credit-registration-admin-linking-candidate-no-name")

const candidateFacts = (t: CreditRegistrationTFunction, candidate: AdminLinkingCandidate) =>
  [
    candidate.email_masked ?? t("credit-registration-admin-linking-candidate-no-address"),
    candidate.enrolled_at
      ? t("credit-registration-admin-linking-candidate-enrolled", {
          time: formatZonedTimestamp(new Date(candidate.enrolled_at)),
        })
      : t("credit-registration-admin-linking-candidate-enrolment-time-unknown"),
    candidate.linking_emails_for_course > 0
      ? t("credit-registration-admin-linking-candidate-emails", {
          count: candidate.linking_emails_for_course,
        })
      : t("credit-registration-admin-linking-candidate-not-emailed"),
  ].join(MIDDLE_DOT)

/**
 * Lets an admin guess which unlinked early enrolee on the code is a student stuck waiting for a
 * student number, and send that person the linking email through the ordinary resend path.
 */
const AdminLinkingCandidatesDialog: React.FC<Props> = ({ open, onClose, registrationId }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const queryClient = useQueryClient()
  const candidatesQuery = useLinkingCandidates(registrationId, open)
  const { control, handleSubmit, watch, reset } = useReasonRequiredForm<Fields>({
    student_number: "",
    override_rate_caps: false,
    reason: "",
  })
  const override = watch("override_rate_caps")
  const data = candidatesQuery.data

  const { result, setResult, mutation } = useActionResult(
    ({ fields, courseId }: { fields: Fields; courseId: string }) =>
      adminResendAccountLinkingEmail({
        body: {
          student_number: fields.student_number,
          course_id: courseId,
          override_rate_caps: fields.override_rate_caps,
          reason: fields.reason.trim() === "" ? null : fields.reason.trim(),
          credit_registration_id: registrationId,
        },
      }),
  )

  const closeDialog = () => {
    onClose()
    reset()
    if (result) {
      setResult(null)
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: getCreditRegistrationAttentionItemsQueryKey() }),
        queryClient.invalidateQueries({
          queryKey: getCreditRegistrationForAdminQueryKey({
            path: { credit_registration_id: registrationId },
          }),
        }),
      ])
    }
  }

  const hasCandidates = Boolean(data && data.candidates.length > 0)
  const submit = handleSubmit((fields) => {
    if (data) {
      mutation.mutate({ fields, courseId: data.course_id })
    }
  })
  const actions: readonly [DialogAction] = [
    {
      label: t("button-text-send-linking-email"),
      variant: BUTTON_PRIMARY,
      isLoading: mutation.isPending,
      disabled: !hasCandidates,
      onPress: () => void submit(),
    },
  ]

  return (
    <Dialog
      open={open}
      onClose={closeDialog}
      title={t("button-text-guess-from-enrolment-list")}
      actions={actions}
    >
      <div className={dialogFormCss}>
        {result && (
          <Infobox tone={result.outcome === RESEND_QUEUED ? TONE.INFO : TONE.WARNING}>
            <div>{resendOutcomeLabel(t, result.outcome)}</div>
            <div>
              {t("credit-registration-resend-mails-so-far", {
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
          </Infobox>
        )}
        {candidatesQuery.isPending && (
          <p className={noteCss}>{t("credit-registration-admin-linking-candidates-loading")}</p>
        )}
        {data?.study_registry_unavailable && (
          <Infobox tone={TONE.WARNING}>
            {t("credit-registration-admin-linking-candidates-unavailable")}
          </Infobox>
        )}
        {data && !data.study_registry_unavailable && !hasCandidates && (
          <p className={proseCss}>{t("credit-registration-admin-linking-candidates-none")}</p>
        )}
        {data && hasCandidates && (
          <form className={dialogFormCss} onSubmit={submit}>
            <p className={proseCss}>
              {t("credit-registration-admin-linking-candidates-intro", { code: data.course_code })}
            </p>
            <RadioGroup
              className={candidateListCss}
              name="student_number"
              control={control}
              label={t("credit-registration-admin-linking-candidates-label")}
              description={t("credit-registration-admin-linking-candidates-order")}
              isRequired
              rules={{ required: t("credit-registration-admin-linking-candidates-pick-one") }}
            >
              {data.candidates.map((candidate) => (
                <Radio
                  key={candidate.student_number}
                  value={candidate.student_number}
                  label={candidateName(t, candidate)}
                  description={
                    <span className={stackedCellCss}>
                      <span>{candidateFacts(t, candidate)}</span>
                      {candidate.similarities.length > 0 && (
                        <span className={rowCss}>
                          {candidate.similarities.map((similarity) => (
                            <Badge key={similarity} tone={TONE.INFO} size={BADGE_COMPACT}>
                              {linkingSimilarityLabel(t, similarity)}
                            </Badge>
                          ))}
                        </span>
                      )}
                    </span>
                  }
                />
              ))}
            </RadioGroup>
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
        )}
      </div>
    </Dialog>
  )
}

export default AdminLinkingCandidatesDialog
