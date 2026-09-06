"use client"

import { useTranslation } from "react-i18next"

import type { MyCreditRegistration } from "@/generated/api/types.generated"
import {
  completionRegistrationRoute,
  userSettingsRoute,
  userSettingsStudentNumberRoute,
} from "@/shared-module/common/utils/routes"

import { registrationStatusState } from "./creditRegistrationCopy"
import { useRequestEnrolmentRecheck } from "./enrolmentActions"
import type { FailureAction } from "./registrationFailures"
import { failureActionLabel, failureActions } from "./registrationFailures"
import type { RegistrationCardAction } from "./RegistrationStatusCard"
import type { SupportMailContents } from "./studentSupportMail"
import { registrationSupportMail } from "./studentSupportMail"
import { mailHref } from "./SupportMailLink"

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
  /** Null while nothing is wrong, so a green "Registered in Sisu" carries no support line. */
  supportMail: SupportMailContents | null
  /**
   * True when `supportMail`'s own action already appears in `primaryAction`/`secondaryActions`, so
   * a caller putting `supportMail` in `meta` should render only its reference, not a second mail
   * link duplicating the one already in the actions row.
   */
  supportMailPromoted: boolean
}

const ACTION_KEY = {
  enrol: "enrol",
  recheckEnrolment: "recheck-enrolment",
  checkStudentNumber: "check-student-number",
  confirmEmail: "confirm-email",
  contactSupport: "contact-support",
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
  const { t } = useTranslation()
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
    label: t("credit-registration-action-recheck-enrolment"),
    onAct: () => recheckEnrolment.mutate(registration),
    isDisabled: !registration.can_request_enrolment_recheck,
    isLoading: recheckEnrolment.isPending,
    ...(registration.can_request_enrolment_recheck
      ? {}
      : { disabledReason: t("credit-registration-enrolment-checked-recently") }),
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
        return recheckEnrolmentAction()
      case "check_own_student_number":
        return checkStudentNumberAction()
      // `contact_support` is the prefilled mail every card renders below its buttons; the rest
      // belong to a teacher or an administrator.
      default:
        return null
    }
  }

  // A `current` row the pipeline no longer expects to move is stuck, and worth a mail; one still
  // moving is not. `not_registering` is no fault, but a student who expected credits from the
  // course has nowhere else to ask.
  const isStuck = state === "current" && !registration.status_is_moving
  const needsSupport =
    state === "failed" || state === "action-needed" || isStuck || status === "not_registering"
  const supportMail = needsSupport ? registrationSupportMail(t, registration) : null

  const levers: RegistrationCardAction[] = []
  let failurePlanHasNoStudentLever = false
  if (state === "failed") {
    const plan = failureActions(registration.error_code, "student")
    failurePlanHasNoStudentLever = plan.primary === null
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

  // A list row linking onward from a failure with no lever of its own would otherwise make the
  // onward link the only, and therefore primary, action — the one thing that can actually help
  // (emailing support) belongs in that seat instead, and the onward link demotes to a text link.
  const promoteSupportMail = linkToStatusPage && state === "failed" && failurePlanHasNoStudentLever
  if (promoteSupportMail && supportMail) {
    levers.push({
      key: ACTION_KEY.contactSupport,
      label: t("credit-registration-action-label-contact-support"),
      href: mailHref(supportMail.subject, supportMail.bodyLines),
    })
  }

  if (linkToStatusPage && (state === "failed" || state === "action-needed")) {
    levers.push({
      key: ACTION_KEY.details,
      label: promoteSupportMail
        ? t("link-text-details-arrow")
        : state === "failed"
          ? t("link-text-see-what-happened")
          : t("link-text-what-to-do"),
      href: completionRegistrationRoute(registration.course_module_id),
      ...(promoteSupportMail ? { appearance: "link" as const } : {}),
    })
  }

  const [primaryAction, ...secondaryActions] = levers
  return {
    primaryAction: primaryAction ?? null,
    secondaryActions,
    supportMail,
    supportMailPromoted: promoteSupportMail,
  }
}
