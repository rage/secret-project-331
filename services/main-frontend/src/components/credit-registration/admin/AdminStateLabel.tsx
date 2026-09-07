"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type {
  CreditRegistrationPendingReason,
  CreditRegistrationState,
} from "@/generated/api/types.generated"
import type { RegistrationStatusState } from "@/shared-module/components"
import { RegistrationStatusBadge } from "@/shared-module/components"

import { registrationLedgerStateLabel } from "../creditRegistrationCopy"
import { monospaceCss, noteCss, rowCss } from "../styles"
import { stateTone } from "./adminCreditRegistrationCopy"
import { STATE_ICONS } from "./stateIcons"

const SUPERSEDED = "superseded" as const
const STATE_ICON_SIZE = 16

/**
 * Ink per tone for the glyph, which is where a flat table's colour now lives.
 *
 * `action-needed` takes the rust red rather than an amber: the yellow ramp is not contrast-safe as
 * ink at any step, and rust still reads clearly apart from the deeper crimson a failure gets.
 */
const TONE_INK: Record<RegistrationStatusState, string> = {
  done: css`
    color: var(--color-green-700);
  `,
  current: css`
    color: var(--color-blue-600);
  `,
  "action-needed": css`
    color: var(--color-red-700);
  `,
  failed: css`
    color: var(--color-crimson-700);
  `,
  superseded: css`
    color: var(--color-gray-400);
  `,
  upcoming: css`
    color: var(--color-gray-400);
  `,
}

const stateCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
`

const iconCss = css`
  flex: none;
`

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

/**
 * One stored state: a glyph in the tone's ink, then the label. The wire name is there to be quoted.
 *
 * A glyph and plain text rather than a filled pill, because a table of these is mostly this
 * column — sixteen pills down a page is chrome, where the glyph gives the same at-a-glance read of
 * what a row is waiting for. Colour appears once per row here; where rows are grouped by stage the
 * heading carries it instead and the glyph stays black.
 */
const AdminStateLabel: React.FC<Props> = ({
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
  const StateIcon = STATE_ICONS[state]

  return (
    <span className={rowCss}>
      <span className={stateCss}>
        <StateIcon
          size={STATE_ICON_SIZE}
          className={cx(iconCss, TONE_INK[stateTone(state, pendingReason)])}
        />
        {registrationLedgerStateLabel(t, state, pendingReason)}
      </span>
      {showToken && <code className={cx(noteCss, monospaceCss)}>{token}</code>}
      {/* Still a badge: it marks the exception rather than labelling every row, so it is the one
          thing in the column worth a filled shape. */}
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

export default AdminStateLabel
