"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { CreditRegistrationAlertSeverity } from "@/generated/api/types.generated"
import { Infobox } from "@/shared-module/components"

import { alertSentence } from "./adminCreditRegistrationCopy"
import { useCreditRegistrationOverview } from "./adminCreditRegistrationHooks"

/** Beyond this the strip becomes wallpaper; the rest are a count with a pointer to the Overview. */
const MAX_SHOWN = 3

// oxlint-disable-next-line i18next/no-literal-string
const WARNING_TONE = "warning" as const
// oxlint-disable-next-line i18next/no-literal-string
const INFO_TONE = "info" as const

const SEVERITY_KEYS = {
  critical: "credit-registration-alert-severity-critical",
  warning: "credit-registration-alert-severity-warning",
} as const satisfies Record<CreditRegistrationAlertSeverity, string>

const rootCss = css`
  display: grid;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
`

const moreCss = css`
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
`

/**
 * The active alert rules, on every tab.
 *
 * Not Overview-only on purpose: somebody who deep-linked into a single registration during an incident
 * still has to be told that the study registry is refusing our credentials.
 *
 * Dashboard-only. Nothing here mails, pages or notifies anybody.
 */
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
          tone={alert.severity === "critical" ? WARNING_TONE : INFO_TONE}
          heading={t(SEVERITY_KEYS[alert.severity] ?? SEVERITY_KEYS.warning)}
        >
          {alertSentence(t, alert.id, alert.count, alert.subject)}
        </Infobox>
      ))}
      {hidden > 0 && (
        <div className={moreCss}>{t("credit-registration-alert-n-more", { count: hidden })}</div>
      )}
    </div>
  )
}

export default CreditRegistrationAlertBanner
