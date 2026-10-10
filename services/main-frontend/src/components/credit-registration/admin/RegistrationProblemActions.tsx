"use client"

import React from "react"

import type { AdminCreditRegistrationRow } from "@/generated/api/types.generated"
import { formatUserName } from "@/hooks/useUserDetails"

import { BUTTON_PRIMARY, BUTTON_SECONDARY } from "../constants"
import { apartCss, rowCss } from "../styles"
import AdminDismissAttentionButton from "./AdminDismissAttentionButton"
import AdminLinkingCandidatesButton from "./AdminLinkingCandidatesButton"
import AdminManualLinkButton from "./AdminManualLinkButton"
import AdminTransitionBlock from "./AdminTransitionBlock"
import {
  GUESS_FROM_ENROLMENT_LIST,
  useStudentNumberStuckActions,
} from "./studentNumberStuckActions"

/**
 * The buttons in a registration page's problem box. A student stuck without a student number gets
 * the linking ones, the best of them primary, and Dismiss unless a dismissal already covers every
 * reason; any other problem gets the hand transitions.
 */
const RegistrationProblemActions: React.FC<{
  registration: AdminCreditRegistrationRow
  isStudentNumberStuck: boolean
  isDismissed: boolean
}> = ({ registration, isStudentNumberStuck, isDismissed }) => {
  const stuckActions = useStudentNumberStuckActions()

  if (!isStudentNumberStuck) {
    return <AdminTransitionBlock registration={registration} isCompact />
  }
  return (
    <div className={rowCss}>
      {stuckActions.map((action, index) => {
        const variant = index === 0 ? BUTTON_PRIMARY : BUTTON_SECONDARY
        return action.key === GUESS_FROM_ENROLMENT_LIST ? (
          <AdminLinkingCandidatesButton
            key={action.key}
            registrationId={registration.id}
            variant={variant}
          />
        ) : (
          <AdminManualLinkButton
            key={action.key}
            account={{
              userId: registration.user_id,
              name: formatUserName(registration),
              email: registration.email ?? null,
            }}
            label={action.label}
            variant={variant}
          />
        )
      })}
      {!isDismissed && (
        <span className={apartCss}>
          <AdminDismissAttentionButton registrationId={registration.id} />
        </span>
      )}
    </div>
  )
}

export default RegistrationProblemActions
