"use client"

import { useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import InlineParts from "@/components/credit-registration/InlineParts"
import {
  getCreditRegistrationAttentionItemsQueryKey,
  getCreditRegistrationForAdminQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { adminResendAccountLinkingEmail } from "@/generated/api/sdk.generated"
import type { DialogAction } from "@/shared-module/components"
import { Badge, Dialog, Infobox, Radio, RadioGroup } from "@/shared-module/components"

import { BADGE_COMPACT, BUTTON_PRIMARY, CREDIT_REGISTRATION_NS, TONE } from "../constants"
import { dialogFormCss, noteCss, proseCss, rowCss, stackedCellCss } from "../styles"
import { useActionResult } from "../useActionResult"
import type { DialogOpenState } from "./AdminActionDialog"
import { linkingSimilarityLabel } from "./adminCreditRegistrationCopy"
import { useLinkingCandidates } from "./adminCreditRegistrationHooks"
import {
  candidateFacts,
  candidateListCss,
  candidateName,
  ResendOutcomeNotice,
  showsNotEmailed,
} from "./linkingCandidate"

interface Props extends DialogOpenState {
  registrationId: string
}

interface Fields {
  student_number: string
}

/**
 * Lets an admin guess which unlinked early enrolee on the code is a student stuck waiting for a
 * student number, and send that person the linking email through the ordinary resend path.
 */
const AdminLinkingCandidatesDialog: React.FC<Props> = ({ isOpen, onClose, registrationId }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const queryClient = useQueryClient()
  const candidatesQuery = useLinkingCandidates(registrationId, isOpen)
  const { control, handleSubmit, watch, reset } = useForm<Fields>({
    defaultValues: { student_number: "" },
  })
  const data = candidatesQuery.data
  const picked = data?.candidates.find(
    (candidate) => candidate.student_number === watch("student_number"),
  )
  const isNotEmailedShown = showsNotEmailed(data?.candidates ?? [])

  const { result, setResult, mutation } = useActionResult(
    ({ fields, courseId }: { fields: Fields; courseId: string }) =>
      adminResendAccountLinkingEmail({
        body: {
          student_number: fields.student_number,
          course_id: courseId,
          override_rate_caps: false,
          reason: null,
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
      label: picked
        ? t("credit-registration-admin-linking-candidates-send-to", {
            name: candidateName(t, picked),
          })
        : t("button-text-send-linking-email"),
      variant: BUTTON_PRIMARY,
      isLoading: mutation.isPending,
      disabled: !picked,
      onPress: () => void submit(),
    },
  ]

  return (
    <Dialog
      open={isOpen}
      onClose={closeDialog}
      title={t("button-text-guess-from-enrolment-list")}
      actions={actions}
    >
      <div className={dialogFormCss}>
        {result && <ResendOutcomeNotice result={result} />}
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
                      <InlineParts parts={candidateFacts(t, candidate, isNotEmailedShown)} />
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
          </form>
        )}
      </div>
    </Dialog>
  )
}

export default AdminLinkingCandidatesDialog
