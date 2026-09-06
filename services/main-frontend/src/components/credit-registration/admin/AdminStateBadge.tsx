"use client"

import { cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type {
  CreditRegistrationPendingReason,
  CreditRegistrationState,
} from "@/generated/api/types.generated"
import { RegistrationStatusBadge } from "@/shared-module/components"

import { registrationLedgerStateLabel } from "../creditRegistrationCopy"
import { monospaceCss, noteCss, rowCss } from "../styles"
import { stateTone } from "./adminCreditRegistrationCopy"

const SUPERSEDED = "superseded" as const

interface Props {
  state: CreditRegistrationState
  pendingReason?: CreditRegistrationPendingReason | null | undefined
  superseded?: boolean
  attemptNumber?: number
  /**
   * The wire name beside the label, for an operator quoting the row to support. Off by default
   * because a list table repeats it down every row for no reason; turn it on for the one row an
   * operator opened the page to act on.
   */
  showToken?: boolean
}

/** One stored state as a badge: the label is the reading, the wire name is there to be quoted. */
const AdminStateBadge: React.FC<Props> = ({
  state,
  pendingReason,
  superseded,
  attemptNumber,
  showToken = false,
}) => {
  const { t } = useTranslation()
  const token = pendingReason ? `${state} (${pendingReason})` : state
  // Rendered, not a tooltip: a retried row is spotted by scanning the list, which rules out hover.
  const isRetry = attemptNumber !== undefined && attemptNumber > 1
  return (
    <span className={rowCss}>
      <RegistrationStatusBadge state={stateTone(state, pendingReason)}>
        {registrationLedgerStateLabel(t, state, pendingReason)}
      </RegistrationStatusBadge>
      {showToken && <code className={cx(noteCss, monospaceCss)}>{token}</code>}
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
