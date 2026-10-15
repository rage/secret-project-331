"use client"

import { useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { getCreditRegistrationDetailsQueryKey } from "@/generated/api/@tanstack/react-query.generated"
import { retryCreditRegistration } from "@/generated/api/sdk.generated"
import type { CourseCreditRegistration } from "@/generated/api/types.generated"
import { manageCourseModulesRoute } from "@/shared-module/common/utils/routes"
import { Button, Infobox, Link } from "@/shared-module/components"

import { BUTTON_SECONDARY, CREDIT_REGISTRATION_NS, TONE } from "./constants"
import { registrationErrorShortLabel } from "./creditRegistrationCopy"
import type { FailureAction } from "./registrationFailures"
import { failureActionLabel, failureActions, failureOwnerHeading } from "./registrationFailures"
import { isUneventfulRefusal, refusalSentence } from "./resubmissionRefusal"
import { rowCss, subsectionCss } from "./styles"
import SupportMailLink from "./SupportMailLink"
import { useInvalidateAfterRetry } from "./teacherCreditRegistrations"
import { useActionResult } from "./useActionResult"

interface Props {
  registration: CourseCreditRegistration
}

const FAILED = "failed" as const
const TEACHER_AUDIENCE = "teacher" as const
const SUPPORT_LINK_APPEARANCE = "link" as const

/**
 * What a teacher can do about one failed registration, and nothing else.
 *
 * Every offer here comes from `failureActions`, so a reason a resubmission cannot clear never
 * gets a retry button; when the teacher has no action at all the block names the owner instead.
 */
const RetryCreditRegistrationBlock: React.FC<Props> = ({ registration }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
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
  if (refusal && !isUneventfulRefusal(refusal)) {
    return (
      <div className={subsectionCss}>
        <Infobox tone={TONE.WARNING}>{refusalSentence(t, refusal)}</Infobox>
      </div>
    )
  }
  if (registration.student_facing_status !== FAILED) {
    return null
  }

  const plan = failureActions(registration.error_code, TEACHER_AUDIENCE)
  const supportLink = (
    <SupportMailLink
      key={plan.remedy}
      subject={t("credit-registration-support-mail-subject", {
        module: registration.course_module_name ?? t("default-module"),
        reason: registrationErrorShortLabel(t, registration.error_code) ?? plan.remedy,
      })}
      bodyLines={[
        `${t("label-credit-registration-support-reference")} ${registration.id}`,
        `${t("label-student")} ${registration.email ?? registration.user_id}`,
      ]}
      reference={registration.id}
      appearance={SUPPORT_LINK_APPEARANCE}
    />
  )

  const render = (action: FailureAction, isPrimary: boolean): React.ReactNode => {
    switch (action) {
      case "retry":
        return (
          <Button
            key={action}
            variant={isPrimary ? "primary" : BUTTON_SECONDARY}
            size="medium"
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(undefined)}
          >
            {failureActionLabel(t, action)}
          </Button>
        )
      case "fix_module_configuration":
        return (
          <Link
            key={action}
            href={manageCourseModulesRoute(registration.course_id)}
            styledAsButton
            variant={isPrimary ? "primary" : BUTTON_SECONDARY}
            size="medium"
          >
            {failureActionLabel(t, action)}
          </Link>
        )
      case "email_student":
        return registration.email ? (
          <Link
            key={action}
            href={`mailto:${registration.email}`}
            styledAsButton
            variant={isPrimary ? "primary" : BUTTON_SECONDARY}
            size="medium"
          >
            {failureActionLabel(t, action)}
          </Link>
        ) : null
      case "contact_support":
        return supportLink
      default:
        return null
    }
  }

  return (
    <div className={subsectionCss}>
      {plan.primary === null && <div>{failureOwnerHeading(t, plan.owner)}</div>}
      <div className={rowCss}>
        {plan.primary && render(plan.primary, true)}
        {plan.secondary.map((action) => render(action, false))}
      </div>
      {result && (
        <Infobox tone={result.refusal ? TONE.WARNING : TONE.SUCCESS}>
          {result.refusal
            ? refusalSentence(t, result.refusal)
            : t("credit-registration-retry-retried")}
        </Infobox>
      )}
    </div>
  )
}

export default RetryCreditRegistrationBlock
