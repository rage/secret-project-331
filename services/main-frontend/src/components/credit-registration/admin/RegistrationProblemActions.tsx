"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { AdminCreditRegistrationRow } from "@/generated/api/types.generated"
import { formatUserName } from "@/hooks/useUserDetails"

import { BUTTON_PRIMARY, BUTTON_SECONDARY, CREDIT_REGISTRATION_NS } from "../constants"
import { failureActionLabel } from "../registrationFailures"
import { useIsAccountLinkingEnabled } from "../useIsAccountLinkingEnabled"
import AdminDismissAttentionButton from "./AdminDismissAttentionButton"
import AdminLinkingCandidatesButton from "./AdminLinkingCandidatesButton"
import AdminManualLinkButton from "./AdminManualLinkButton"
import AdminTransitionBlock from "./AdminTransitionBlock"
import type { RemedyOffer } from "./handActionOffers"

const LINK_BY_HAND: RemedyOffer = "link_student_number_by_hand"

const rowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
`

/** Pushed to the far end: dismissing does not move the registration forward. */
const apartCss = css`
  margin-left: auto;
`

/**
 * The buttons in a registration page's problem box. A student stuck without a student number gets
 * the linking ones, led by a guess from the enrolment list when the code has unmailed early
 * enrolees; any other problem gets the hand transitions.
 */
const RegistrationProblemActions: React.FC<{
  registration: AdminCreditRegistrationRow
  isStudentNumberStuck: boolean
  unmailedEarlyEnroleeCount: number | null
}> = ({ registration, isStudentNumberStuck, unmailedEarlyEnroleeCount }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const isAccountLinkingEnabled = useIsAccountLinkingEnabled()

  if (!isStudentNumberStuck) {
    return <AdminTransitionBlock registration={registration} isCompact />
  }
  const canGuess = isAccountLinkingEnabled && (unmailedEarlyEnroleeCount ?? 0) > 0
  return (
    <div className={rowCss}>
      {canGuess && (
        <AdminLinkingCandidatesButton registrationId={registration.id} variant={BUTTON_PRIMARY} />
      )}
      <AdminManualLinkButton
        account={{
          userId: registration.user_id,
          name: formatUserName(registration),
          email: registration.email ?? null,
        }}
        label={failureActionLabel(t, LINK_BY_HAND)}
        variant={canGuess ? BUTTON_SECONDARY : BUTTON_PRIMARY}
      />
      <span className={apartCss}>
        <AdminDismissAttentionButton registrationId={registration.id} />
      </span>
    </div>
  )
}

export default RegistrationProblemActions
