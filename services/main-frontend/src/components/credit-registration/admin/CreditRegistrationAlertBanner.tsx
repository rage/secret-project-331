"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type {
  CreditRegistrationAlert,
  CreditRegistrationAlertSeverity,
} from "@/generated/api/types.generated"
import type { BadgeTone } from "@/shared-module/components"
import { Badge, Disclosure, Infobox } from "@/shared-module/components"

import { TONE } from "../constants"
import { widenedLookup } from "../labelFrom"
import { alertSentence } from "./adminCreditRegistrationCopy"
import { useCreditRegistrationOverview } from "./adminCreditRegistrationHooks"

const MAX_SHOWN = 3

const SEVERITY_KEYS = {
  critical: "credit-registration-alert-severity-critical",
  warning: "credit-registration-alert-severity-warning",
  info: "credit-registration-alert-severity-info",
} as const satisfies Record<CreditRegistrationAlertSeverity, string>

// Infobox has no danger tone, so the severity badge is what tells a critical alert from a warning.
const SEVERITY_BADGE_TONES = {
  critical: TONE.DANGER,
  warning: TONE.WARNING,
  info: TONE.NEUTRAL,
} as const satisfies Record<CreditRegistrationAlertSeverity, BadgeTone>

// oxlint-disable-next-line i18next/no-literal-string
const INFO_SEVERITY: CreditRegistrationAlertSeverity = "info"

const rootCss = css`
  display: grid;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
`

const bodyCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: baseline;
`

const restCss = css`
  display: grid;
  gap: 0.5rem;
`

const AlertLine: React.FC<{ alert: CreditRegistrationAlert }> = ({ alert }) => {
  const { t } = useTranslation()
  return (
    <span className={bodyCss}>
      <Badge tone={widenedLookup(SEVERITY_BADGE_TONES, alert.severity) ?? TONE.WARNING}>
        {t(widenedLookup(SEVERITY_KEYS, alert.severity) ?? SEVERITY_KEYS.warning)}
      </Badge>
      <span>{alertSentence(t, alert.id, alert.count, alert.subject, alert.total)}</span>
    </span>
  )
}

/** The health rules that are firing right now, worst first, on every tab of the shell. */
const CreditRegistrationAlertBanner: React.FC = () => {
  const { t } = useTranslation()
  const overviewQuery = useCreditRegistrationOverview()
  const alerts = overviewQuery.data?.health.alerts ?? []
  if (alerts.length === 0) {
    return null
  }
  const shown = alerts.slice(0, MAX_SHOWN)
  const rest = alerts.slice(MAX_SHOWN)

  return (
    <div className={rootCss}>
      {shown.map((alert) => (
        <Infobox key={alert.id} tone={alert.severity === INFO_SEVERITY ? TONE.INFO : TONE.WARNING}>
          <AlertLine alert={alert} />
        </Infobox>
      ))}
      {rest.length > 0 && (
        <Disclosure title={t("credit-registration-alert-n-more", { count: rest.length })}>
          <div className={restCss}>
            {rest.map((alert) => (
              <AlertLine key={alert.id} alert={alert} />
            ))}
          </div>
        </Disclosure>
      )}
    </div>
  )
}

export default CreditRegistrationAlertBanner
