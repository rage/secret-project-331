"use client"

import { css } from "@emotion/css"
import React from "react"

import type { CreditRegistrationState } from "@/generated/api/types.generated"
import { RegistrationStatusBadge } from "@/shared-module/components"

import { stateTone } from "./adminCreditRegistrationCopy"

interface Props {
  state: CreditRegistrationState
  superseded?: boolean
  attemptNumber?: number
}

const supersededCss = css`
  opacity: 0.6;
  text-decoration: line-through;
`

/** The state name is deliberately untranslated: it is the identifier an operator quotes. */
const AdminStateBadge: React.FC<Props> = ({ state, superseded, attemptNumber }) => (
  <span className={superseded ? supersededCss : undefined}>
    <RegistrationStatusBadge state={stateTone(state)}>
      {attemptNumber !== undefined && attemptNumber > 1 ? `${attemptNumber}· ${state}` : state}
    </RegistrationStatusBadge>
  </span>
)

export default AdminStateBadge
