"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { resendCourseCreditRegistrationLinkingEmail } from "@/generated/api/sdk.generated"
import type {
  CourseCreditRegistration,
  ResendLinkingEmailOutcome,
  ResendLinkingEmailResult,
} from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { Button, Infobox, TextField } from "@/shared-module/components"

import { linkingEmailSentence } from "./teacherCreditRegistrations"

interface Props {
  registration: CourseCreditRegistration
}

interface Fields {
  student_number: string
}

const rootCss = css`
  display: grid;
  gap: 0.75rem;
  margin-top: 1.5rem;
`

const rowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: end;
`

const OUTCOME_KEYS = {
  queued: "credit-registration-resend-queued",
  already_mailed_to_every_known_address: "credit-registration-resend-already-mailed",
  refused_by_rate_cap: "credit-registration-resend-refused-by-rate-cap",
  no_address_in_study_registry: "credit-registration-resend-no-address",
  not_on_the_course_roster: "credit-registration-resend-not-on-roster",
  no_student_number_known: "credit-registration-resend-no-student-number",
  already_linked: "credit-registration-resend-already-linked",
  study_registry_unavailable: "credit-registration-resend-registry-unavailable",
} as const satisfies Record<ResendLinkingEmailOutcome, string>

type OutcomeKey = (typeof OUTCOME_KEYS)[ResendLinkingEmailOutcome]

const SUCCESS_OUTCOME: ResendLinkingEmailOutcome = "queued"
// oxlint-disable-next-line i18next/no-literal-string
const QUEUED_TONE = "info" as const
// oxlint-disable-next-line i18next/no-literal-string
const REFUSED_TONE = "warning" as const

/**
 * The teacher's one linking-mail action. Every refusal is reported as it came back: the per-person
 * caps are not overridable here, and a teacher who needs one lifted has to ask an admin.
 */
const ResendLinkingEmailBlock: React.FC<Props> = ({ registration }) => {
  const { t, i18n } = useTranslation()
  const [result, setResult] = useState<ResendLinkingEmailResult | null>(null)
  const { control, handleSubmit } = useForm<Fields>({
    defaultValues: { student_number: registration.student_number ?? "" },
  })

  const mutation = useToastMutation(
    (fields: Fields) =>
      resendCourseCreditRegistrationLinkingEmail({
        path: { course_id: registration.course_id },
        body: {
          user_id: registration.user_id,
          student_number: fields.student_number.trim() === "" ? null : fields.student_number.trim(),
        },
      }),
    { notify: false },
    { onSuccess: setResult },
  )

  const outcomeKey: OutcomeKey | undefined = result
    ? (OUTCOME_KEYS as Record<string, OutcomeKey | undefined>)[result.outcome]
    : undefined

  return (
    <form className={rootCss} onSubmit={handleSubmit((fields) => mutation.mutate(fields))}>
      <div className={rowCss}>
        <TextField
          name="student_number"
          control={control}
          label={t("label-student-number")}
          description={t("description-resend-linking-email-student-number")}
        />
        <Button variant="secondary" size="medium" type="submit" disabled={mutation.isPending}>
          {t("button-text-resend-linking-email")}
        </Button>
      </div>
      {result && (
        <Infobox tone={result.outcome === SUCCESS_OUTCOME ? QUEUED_TONE : REFUSED_TONE}>
          <div>{t(outcomeKey ?? OUTCOME_KEYS.study_registry_unavailable)}</div>
          {result.linking_email && (
            <div>
              {linkingEmailSentence(
                t,
                result.linking_email.email_send_status,
                result.linking_email.sent_at,
                result.linking_email.emailed_to_masked,
                i18n.language,
              )}
            </div>
          )}
          <div>
            {t("credit-registration-resend-mails-so-far", {
              sent: result.mails_sent_for_this_course,
              max: result.max_mails_per_person_and_course,
            })}
          </div>
        </Infobox>
      )}
    </form>
  )
}

export default ResendLinkingEmailBlock
