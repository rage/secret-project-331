"use client"

import { useTranslation } from "react-i18next"

import type { MyCreditRegistration } from "@/generated/api/types.generated"
import { includeIf } from "@/shared-module/common/utils/nullability"
import {
  completionRegistrationRoute,
  userSettingsRoute,
  userSettingsStudentNumberRoute,
} from "@/shared-module/common/utils/routes"

import { CREDIT_REGISTRATION_NS } from "./constants"
import { registrationStatusState } from "./creditRegistrationCopy"
import { useRequestEnrolmentRecheck } from "./enrolmentActions"
import type { FailureAction } from "./registrationFailures"
import { failureActionLabel, failureActions } from "./registrationFailures"
import type { RegistrationCardAction } from "./RegistrationStatusCard"

export interface StudentRegistrationActionsOptions {
  registration: MyCreditRegistration
  /** From `useCanConfirmEmailAddress`. Adds the fast track when the emailed link is out of reach. */
  canConfirmEmail: boolean
  /** Set on a list. The registration's own status page has nowhere further to send the reader. */
  linkToStatusPage: boolean
}

export interface StudentRegistrationActions {
  /** Null when nothing this student does helps; the explanation then says who is on it. */
  primaryAction: RegistrationCardAction | null
  secondaryActions: RegistrationCardAction[]
}

/** The one lever the enrolment wait offers, which that band picks out of the plan by key. */
export const RECHECK_ENROLMENT_ACTION_KEY = "recheck-enrolment"

/** The one lever the linking band offers, which that band picks out of the plan by key. */
export const CONFIRM_EMAIL_ACTION_KEY = "confirm-email"

const ACTION_KEY = {
  enrol: "enrol",
  recheckEnrolment: RECHECK_ENROLMENT_ACTION_KEY,
  checkStudentNumber: "check-student-number",
  confirmEmail: CONFIRM_EMAIL_ACTION_KEY,
  details: "details",
}

/**
 * The levers one student may pull on one registration, in the order they should be offered.
 *
 * The one place that answers it, so the hub, the status page and the settings card cannot come to
 * offer a state a button on one and a grey note on another. Pair it with
 * `StudentRegistrationExplanation`, which says the matching sentence.
 */
export const useStudentRegistrationActions = ({
  registration,
  canConfirmEmail,
  linkToStatusPage,
}: StudentRegistrationActionsOptions): StudentRegistrationActions => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const recheckEnrolment = useRequestEnrolmentRecheck()

  const status = registration.student_facing_status
  const state = registrationStatusState(status)

  const enrolAction = (): RegistrationCardAction | null =>
    registration.enrolment_link
      ? {
          key: ACTION_KEY.enrol,
          label: t("credit-registration-action-enrol"),
          href: registration.enrolment_link,
        }
      : null

  const recheckEnrolmentAction = (): RegistrationCardAction => ({
    key: ACTION_KEY.recheckEnrolment,
    label: t("credit-registration-action-look-again"),
    onAct: () => recheckEnrolment.mutate(registration),
    isDisabled: !registration.can_request_enrolment_recheck,
    isLoading: recheckEnrolment.isPending,
    ...includeIf(!registration.can_request_enrolment_recheck, {
      disabledReason: t("credit-registration-enrolment-checked-recently"),
    }),
  })

  const checkStudentNumberAction = (): RegistrationCardAction => ({
    key: ACTION_KEY.checkStudentNumber,
    label: failureActionLabel(t, "check_own_student_number"),
    href: userSettingsStudentNumberRoute(),
  })

  const confirmEmailAction = (): RegistrationCardAction => ({
    key: ACTION_KEY.confirmEmail,
    label: t("button-confirm-your-email-address"),
    href: userSettingsRoute(),
  })

  const studentLever = (action: FailureAction): RegistrationCardAction | null => {
    switch (action) {
      case "enrol":
        return enrolAction()
      case "recheck_enrolment":
        // The endpoint only accepts a row parked on a missing enrolment. Anywhere else the button
        // could only ever render greyed out, under a reason that is not the real one.
        return status === "needs_enrolment" ? recheckEnrolmentAction() : null
      case "check_own_student_number":
        return checkStudentNumberAction()
      // Every remaining action belongs to a teacher or an administrator; `contact_support` is not
      // offered to students at all.
      default:
        return null
    }
  }

  const levers: RegistrationCardAction[] = []
  if (state === "failed") {
    const plan = failureActions(registration.error_code, "student")
    for (const action of [...(plan.primary ? [plan.primary] : []), ...plan.secondary]) {
      const lever = studentLever(action)
      if (lever) {
        levers.push(lever)
      }
    }
  } else if (status === "needs_enrolment") {
    const enrol = enrolAction()
    if (enrol) {
      levers.push(enrol)
    }
    levers.push(recheckEnrolmentAction())
  } else if (status === "needs_student_number" && canConfirmEmail) {
    levers.push(confirmEmailAction())
  }

  if (linkToStatusPage && (state === "failed" || state === "action-needed")) {
    levers.push({
      key: ACTION_KEY.details,
      label: state === "failed" ? t("link-text-see-what-happened") : t("link-text-what-to-do"),
      href: completionRegistrationRoute(registration.course_module_id),
    })
  }

  const [primaryAction, ...secondaryActions] = levers
  return { primaryAction: primaryAction ?? null, secondaryActions }
}
