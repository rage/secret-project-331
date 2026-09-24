"use client"

import { useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { getCreditRegistrationDetailsQueryKey } from "@/generated/api/@tanstack/react-query.generated"
import { recheckCreditRegistrationEnrolment } from "@/generated/api/sdk.generated"
import type { CourseCreditRegistration } from "@/generated/api/types.generated"
import { Button, Infobox, RelativeTime } from "@/shared-module/components"

import { BUTTON_SECONDARY, CREDIT_REGISTRATION_NS, TIME_COMPACT, TONE } from "./constants"
import { noteCss, rowCss, subsectionCss } from "./styles"
import { useInvalidateAfterRetry } from "./teacherCreditRegistrations"
import { useActionResult } from "./useActionResult"

interface Props {
  registration: CourseCreditRegistration
}

const NO_USABLE_ENROLMENT = "no_usable_enrolment" as const

/**
 * A teacher's way to have a registration waiting for an enrolment looked up again, for when the
 * student says they have enrolled. Shares the student's hourly allowance, so it is greyed out with
 * the time it comes back rather than hidden.
 */
const EnrolmentRecheckBlock: React.FC<Props> = ({ registration }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const queryClient = useQueryClient()
  const invalidateAfterRetry = useInvalidateAfterRetry(registration.course_id)

  const { result, mutation } = useActionResult(
    () =>
      recheckCreditRegistrationEnrolment({
        path: { credit_registration_id: registration.id },
      }),
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

  if (registration.state !== NO_USABLE_ENROLMENT && !result) {
    return null
  }

  const allowedAgainAt =
    result?.next_recheck_allowed_at ?? registration.next_enrolment_recheck_allowed_at
  return (
    <div className={subsectionCss}>
      {registration.state === NO_USABLE_ENROLMENT && (
        <div className={rowCss}>
          <Button
            variant={BUTTON_SECONDARY}
            size="medium"
            type="button"
            disabled={!registration.can_request_enrolment_recheck || mutation.isPending}
            isLoading={mutation.isPending}
            onClick={() => mutation.mutate(undefined)}
          >
            {t("credit-registration-teacher-action-recheck-enrolment")}
          </Button>
        </div>
      )}
      {!registration.can_request_enrolment_recheck &&
        allowedAgainAt &&
        !result?.recheck_started && (
          <p className={noteCss}>
            {t("credit-registration-teacher-enrolment-checked-recently")}{" "}
            <RelativeTime at={allowedAgainAt} absoluteTime={TIME_COMPACT} />
          </p>
        )}
      {result?.recheck_started && (
        <Infobox tone={TONE.SUCCESS}>
          {t("credit-registration-teacher-enrolment-recheck-started")}
        </Infobox>
      )}
    </div>
  )
}

export default EnrolmentRecheckBlock
