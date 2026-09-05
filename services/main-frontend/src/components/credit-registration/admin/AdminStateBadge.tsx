"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type {
  CreditRegistrationPendingReason,
  CreditRegistrationState,
} from "@/generated/api/types.generated"
import { RegistrationStatusBadge } from "@/shared-module/components"

import { noteCss, rowCss } from "../styles"
import { stateTone } from "./adminCreditRegistrationCopy"

// oxlint-disable-next-line i18next/no-literal-string
const SUPERSEDED = "superseded" as const

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
  // Rendered, not a tooltip: a retried row is spotted by scanning the list, which rules out hover.
  const isRetry = attemptNumber !== undefined && attemptNumber > 1
  return (
    <span className={rowCss}>
      <RegistrationStatusBadge state={stateTone(state, pendingReason)}>
        {name}
      </RegistrationStatusBadge>
      {/* Its own badge rather than a strike-through over the state: a struck-through pill reads as
          a rendering fault, and the state itself is still true of the attempt. */}
      {superseded && (
        <RegistrationStatusBadge state={SUPERSEDED} size="compact">
          {t("credit-registration-admin-replaced")}
        </RegistrationStatusBadge>
      )}
      {isRetry && (
        <span className={noteCss}>{t("credit-registration-attempt-n", { n: attemptNumber })}</span>
      )}
    </span>
  )
}

export default AdminStateBadge
