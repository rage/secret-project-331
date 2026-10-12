"use client"

import { useTranslation } from "react-i18next"

import { CREDIT_REGISTRATION_NS } from "../constants"
import { failureActionLabel } from "../registrationFailures"
import { useIsAccountLinkingEnabled } from "../useIsAccountLinkingEnabled"
import type { RemedyOffer } from "./handActionOffers"

export const GUESS_FROM_ENROLMENT_LIST = "guess_from_enrolment_list"
export const LINK_BY_HAND = "link_student_number_by_hand" satisfies RemedyOffer

/** A linking action for a student stuck without a student number; each surface renders its own. */
export interface StudentNumberStuckAction {
  key: typeof GUESS_FROM_ENROLMENT_LIST | typeof LINK_BY_HAND
  label: string
}

/**
 * The linking actions for a student stuck without a student number, best first: a guess from the
 * enrolment list while account linking is on, then linking by hand.
 */
export const useStudentNumberStuckActions = (): StudentNumberStuckAction[] => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const canGuess = useIsAccountLinkingEnabled()
  const linkByHand: StudentNumberStuckAction = {
    key: LINK_BY_HAND,
    label: failureActionLabel(t, LINK_BY_HAND),
  }
  return canGuess
    ? [
        { key: GUESS_FROM_ENROLMENT_LIST, label: t("button-text-guess-from-enrolment-list") },
        linkByHand,
      ]
    : [linkByHand]
}
