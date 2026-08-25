"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { CreditRegistrationAlertSeverity } from "@/generated/api/types.generated"
import { Infobox } from "@/shared-module/components"

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

// oxlint-disable-next-line i18next/no-literal-string
const CRITICAL_SEVERITY: CreditRegistrationAlertSeverity = "critical"

const rootCss = css`
  display: grid;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
`

const moreCss = css`
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
`

const CreditRegistrationAlertBanner: React.FC = () => {
  const { t } = useTranslation()
  const overviewQuery = useCreditRegistrationOverview()
  const alerts = overviewQuery.data?.health.alerts ?? []
  if (alerts.length === 0) {
    return null
  }
  const shown = alerts.slice(0, MAX_SHOWN)
  const hidden = alerts.length - shown.length

  return (
    <div className={rootCss}>
      {shown.map((alert) => (
        <Infobox
          key={alert.id}
          tone={alert.severity === CRITICAL_SEVERITY ? TONE.WARNING : TONE.INFO}
          heading={t(widenedLookup(SEVERITY_KEYS, alert.severity) ?? SEVERITY_KEYS.warning)}
        >
          {alertSentence(t, alert.id, alert.count, alert.subject, alert.total)}
        </Infobox>
      ))}
      {hidden > 0 && (
        <div className={moreCss}>{t("credit-registration-alert-n-more", { count: hidden })}</div>
      )}
    </div>
  )
}

export default CreditRegistrationAlertBanner
