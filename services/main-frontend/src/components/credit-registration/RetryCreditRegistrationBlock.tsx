"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  getCourseCreditRegistrationActionsQueryKey,
  getCourseCreditRegistrationSummaryQueryKey,
  getCreditRegistrationDetailsQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { retryCreditRegistration } from "@/generated/api/sdk.generated"
import type {
  CourseCreditRegistration,
  RetryCreditRegistrationResult,
} from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { Button, Infobox } from "@/shared-module/components"

import { TONE } from "./constants"
import { RETRIED, retryOutcomeSentence } from "./creditRegistrationRetry"
import { invalidateTeacherCreditRegistrations } from "./teacherCreditRegistrations"

interface Props {
  registration: CourseCreditRegistration
}

const rootCss = css`
  display: grid;
  gap: 0.75rem;
  margin-top: 1.5rem;
`

/** The one state a teacher may put back on the queue; everything else is refused server side. */
// oxlint-disable-next-line i18next/no-literal-string
const FAILED_FOR_GOOD = "failed_permanent" as const

/** Looks retriable and is not, so the reason is spelled out where the button would have been. */
// oxlint-disable-next-line i18next/no-literal-string
const OUTCOME_UNKNOWN = "submission_uncertain" as const

// oxlint-disable-next-line i18next/no-literal-string
const REFUSED_SUBMISSION_UNCERTAIN = "refused_submission_uncertain" as const

const RetryCreditRegistrationBlock: React.FC<Props> = ({ registration }) => {
  const { t } = useTranslation()
  const [result, setResult] = useState<RetryCreditRegistrationResult | null>(null)
  const queryClient = useQueryClient()

  const mutation = useToastMutation(
    () => retryCreditRegistration({ path: { credit_registration_id: registration.id }, body: {} }),
    { notify: false },
    {
      onSuccess: async (data) => {
        setResult(data)
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: getCreditRegistrationDetailsQueryKey({
              path: { credit_registration_id: registration.id },
            }),
          }),
          queryClient.invalidateQueries({
            queryKey: getCourseCreditRegistrationSummaryQueryKey({
              path: { course_id: registration.course_id },
            }),
          }),
          queryClient.invalidateQueries({
            queryKey: getCourseCreditRegistrationActionsQueryKey({
              path: { course_id: registration.course_id },
            }),
          }),
          invalidateTeacherCreditRegistrations(queryClient),
        ])
      },
    },
  )

  if (registration.state === OUTCOME_UNKNOWN) {
    return (
      <div className={rootCss}>
        <Infobox tone={TONE.WARNING}>
          {retryOutcomeSentence(t, REFUSED_SUBMISSION_UNCERTAIN)}
        </Infobox>
      </div>
    )
  }
  if (registration.state !== FAILED_FOR_GOOD) {
    return null
  }

  return (
    <div className={rootCss}>
      <div>
        <Button
          variant="secondary"
          size="medium"
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(undefined)}
        >
          {t("button-text-retry-credit-registration")}
        </Button>
      </div>
      {result && (
        <Infobox tone={result.outcome === RETRIED ? TONE.INFO : TONE.WARNING}>
          {retryOutcomeSentence(t, result.outcome)}
        </Infobox>
      )}
    </div>
  )
}

export default RetryCreditRegistrationBlock
