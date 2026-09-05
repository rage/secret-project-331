"use client"

import { cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type {
  CreditRegistrationPendingReason,
  CreditRegistrationState,
} from "@/generated/api/types.generated"
import { RegistrationStatusBadge } from "@/shared-module/components"

import { noteCss, rowCss, supersededCss } from "../styles"
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
  // Rendered, not a tooltip: a retried row is spotted by scanning the list, which rules out hover.
  const isRetry = attemptNumber !== undefined && attemptNumber > 1
  return (
    <span className={cx(rowCss, superseded && supersededCss)}>
      <RegistrationStatusBadge state={stateTone(state, pendingReason)}>
        {name}
      </RegistrationStatusBadge>
      {isRetry && (
        <span className={noteCss}>{t("credit-registration-attempt-n", { n: attemptNumber })}</span>
      )}
    </span>
  )
}

export default AdminStateBadge
