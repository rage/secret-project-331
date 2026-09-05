"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type {
  CreditRegistrationPendingReason,
  CreditRegistrationState,
} from "@/generated/api/types.generated"
import { RegistrationStatusBadge } from "@/shared-module/components"

import { supersededCss } from "../styles"
import { stateTone } from "./adminCreditRegistrationCopy"

interface Props {
  state: CreditRegistrationState
  pendingReason?: CreditRegistrationPendingReason | null | undefined
  superseded?: boolean
  attemptNumber?: number
}

/** The state name is deliberately untranslated: it is the identifier an operator quotes. */
const AdminStateBadge: React.FC<Props> = ({ state, pendingReason, superseded, attemptNumber }) => {
  const { t } = useTranslation()
  // `pending` on its own does not say what the row is waiting for.
  const name = pendingReason ? `${state} (${pendingReason})` : state
  return (
    <span
      className={superseded ? supersededCss : undefined}
      title={
        attemptNumber !== undefined && attemptNumber > 1
          ? t("credit-registration-attempt-n", { n: attemptNumber })
          : undefined
      }
    >
      <RegistrationStatusBadge state={stateTone(state, pendingReason)}>
        {name}
      </RegistrationStatusBadge>
    </span>
  )
}

export default AdminStateBadge
