"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { resendCourseCreditRegistrationLinkingEmail } from "@/generated/api/sdk.generated"
import type {
  CourseCreditRegistration,
  ResendLinkingEmailResult,
} from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { Button, Infobox, TextField } from "@/shared-module/components"

import { RESEND_QUEUED, resendOutcomeLabel } from "../resendOutcome"
import { linkingEmailSentence } from "../teacherCreditRegistrations"

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

// oxlint-disable-next-line i18next/no-literal-string
const QUEUED_TONE = "info" as const
// oxlint-disable-next-line i18next/no-literal-string
const REFUSED_TONE = "warning" as const

/** The per-person caps are not overridable here, so a refusal is reported as it came back. */
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

  return (
    <form className={rootCss} onSubmit={handleSubmit((fields) => mutation.mutate(fields))}>
      <Infobox>{t("credit-registration-resend-address-they-can-read-hint")}</Infobox>
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
        <Infobox tone={result.outcome === RESEND_QUEUED ? QUEUED_TONE : REFUSED_TONE}>
          <div>{resendOutcomeLabel(t, result.outcome)}</div>
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
