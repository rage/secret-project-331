"use client"

import { css } from "@emotion/css"
import React from "react"

import type { CreditRegistrationState } from "@/generated/api/types.generated"
import { RegistrationStatusBadge } from "@/shared-module/components"

import { stateTone } from "./adminCreditRegistrationCopy"

interface Props {
  state: CreditRegistrationState
  /** Replaced by a later attempt: shown, never actionable. */
  superseded?: boolean
  attemptNumber?: number
}

const supersededCss = css`
  opacity: 0.6;
  text-decoration: line-through;
`

/**
 * A ledger state as a pill, labelled with the state name itself.
 *
 * Not translated on purpose: the state name is the identifier an operator quotes in a message to the
 * university, and a Finnish rendering of it would be useless for that. The colour and icon carry the
 * "how bad is this" reading; the word carries the identity.
 */
const AdminStateBadge: React.FC<Props> = ({ state, superseded, attemptNumber }) => (
  <span className={superseded ? supersededCss : undefined}>
    <RegistrationStatusBadge state={stateTone(state)}>
      {attemptNumber !== undefined && attemptNumber > 1 ? `${attemptNumber}· ${state}` : state}
    </RegistrationStatusBadge>
  </span>
)

export default AdminStateBadge
