"use client"

import { useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { getCreditRegistrationDetailsQueryKey } from "@/generated/api/@tanstack/react-query.generated"
import { retryCreditRegistration } from "@/generated/api/sdk.generated"
import type { CourseCreditRegistration } from "@/generated/api/types.generated"
import { Button, Infobox } from "@/shared-module/components"

import { TONE } from "./constants"
import { isUneventfulRefusal, refusalSentence } from "./resubmissionRefusal"
import { subsectionCss } from "./styles"
import { useInvalidateAfterRetry } from "./teacherCreditRegistrations"
import { useActionResult } from "./useActionResult"

interface Props {
  registration: CourseCreditRegistration
}

/** The retry button, or the reason the server gives for there not being one. */
const RetryCreditRegistrationBlock: React.FC<Props> = ({ registration }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const invalidateAfterRetry = useInvalidateAfterRetry(registration.course_id)

  const { result, mutation } = useActionResult(
    () => retryCreditRegistration({ path: { credit_registration_id: registration.id }, body: {} }),
    async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getCreditRegistrationDetailsQueryKey({
            path: { credit_registration_id: registration.id },
          }),
        }),
        invalidateAfterRetry(),
      ])
    },
  )

  const refusal = registration.resubmission_refusal
  if (refusal) {
    return isUneventfulRefusal(refusal) ? null : (
      <div className={subsectionCss}>
        <Infobox tone={TONE.WARNING}>{refusalSentence(t, refusal)}</Infobox>
      </div>
    )
  }

  return (
    <div className={subsectionCss}>
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
        <Infobox tone={result.refusal ? TONE.WARNING : TONE.INFO}>
          {result.refusal
            ? refusalSentence(t, result.refusal)
            : t("credit-registration-retry-retried")}
        </Infobox>
      )}
    </div>
  )
}

export default RetryCreditRegistrationBlock
