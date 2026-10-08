import type { AdminCreditRegistrationRow } from "@/generated/api/types.generated"

import type { FailureAction } from "../registrationFailures"
import { failureActions } from "../registrationFailures"

export const RESUBMIT = "resubmit" as const
export const CHECK_NOW_OFFER = "check_now" as const

/** The failure remedies that leave the row alone: links and dialogs of their own. */
export type RemedyOffer = Extract<
  FailureAction,
  | "fix_module_configuration"
  | "email_student"
  | "link_student_number_by_hand"
  | "resend_student_number_link"
>

/** One action the single-row page lists above its housekeeping (dismissing, cancelling). */
export type HandActionOffer = typeof RESUBMIT | typeof CHECK_NOW_OFFER | RemedyOffer

export interface HandActionOffers {
  /** In the order they should be tried. */
  offers: HandActionOffer[]
  /** The one worth the primary button; `null` when nothing is clearly the next step. */
  recommended: HandActionOffer | null
}

const REMEDY_OFFERS: ReadonlySet<FailureAction> = new Set<RemedyOffer>([
  "fix_module_configuration",
  "email_student",
  "link_student_number_by_hand",
  "resend_student_number_link",
])

const isRemedyOffer = (action: FailureAction): action is RemedyOffer => REMEDY_OFFERS.has(action)

/** The remedies a page can render for a row, given what it knows about the student. */
export const renderableRemedies = ({
  hasEmail,
  hasStudentNumber,
  isAccountLinkingEnabled,
}: {
  hasEmail: boolean
  hasStudentNumber: boolean
  isAccountLinkingEnabled: boolean
}): ReadonlySet<RemedyOffer> => {
  const remedies = new Set<RemedyOffer>(["fix_module_configuration"])
  if (hasEmail) {
    remedies.add("email_student")
  }
  if (hasStudentNumber) {
    remedies.add("link_student_number_by_hand")
    if (isAccountLinkingEnabled) {
      remedies.add("resend_student_number_link")
    }
  }
  return remedies
}

/**
 * The actions one row is offered, led by the one that could fix it.
 *
 * The server decides whether a resend or a check is possible at all; the failure's remedy plan
 * decides the order. A row whose submission verify is waiting on gets only the check, because the
 * failure plan describes an earlier answer. `availableRemedies` comes from `renderableRemedies`.
 */
export const handActionOffers = (
  row: Pick<AdminCreditRegistrationRow, "state" | "error_code" | "hand_actions">,
  availableRemedies: ReadonlySet<RemedyOffer>,
): HandActionOffers => {
  const { resubmission } = row.hand_actions
  const checkNow = row.hand_actions.check_now ?? null
  const canResubmit = resubmission.kind === "allowed"
  const offers: HandActionOffer[] = []
  let recommended: HandActionOffer | null = null
  const offer = (action: HandActionOffer | null, isRecommended: boolean) => {
    if (action === null || offers.includes(action)) {
      return
    }
    offers.push(action)
    if (isRecommended) {
      recommended = action
    }
  }

  if (checkNow === "attainment") {
    offer(CHECK_NOW_OFFER, row.state === "submission_uncertain")
  } else {
    const plan = failureActions(row.error_code, "admin")
    for (const action of [plan.primary, ...plan.secondary]) {
      if (action === null) {
        continue
      }
      const isRecommended = action === plan.primary
      if (action === "retry") {
        // A backoff's own retry is the lighter fix: it keeps the payload it was going to send.
        offer(
          checkNow === "next_attempt" ? CHECK_NOW_OFFER : canResubmit ? RESUBMIT : null,
          isRecommended,
        )
      } else if (action === "recheck_registry") {
        offer(checkNow === null ? null : CHECK_NOW_OFFER, isRecommended)
      } else if (isRemedyOffer(action) && availableRemedies.has(action)) {
        offer(action, isRecommended)
      }
    }
    offer(checkNow === null ? null : CHECK_NOW_OFFER, false)
  }
  offer(canResubmit ? RESUBMIT : null, false)
  return { offers, recommended }
}
