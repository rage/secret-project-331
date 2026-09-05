"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { CreditRegistrationAlertSeverity } from "@/generated/api/types.generated"
import type { InfoboxTone } from "@/shared-module/components"
import { Disclosure, Infobox } from "@/shared-module/components"

import { TONE } from "../constants"
import { widenedLookup } from "../labelFrom"
import { dividedListCss, sectionCss } from "../styles"
import { alertSentence } from "./adminCreditRegistrationCopy"
import { useCreditRegistrationOverview } from "./adminCreditRegistrationHooks"

const MAX_SHOWN = 3

const SEVERITY_TONES = {
  critical: TONE.DANGER,
  warning: TONE.WARNING,
  info: TONE.INFO,
} as const satisfies Record<CreditRegistrationAlertSeverity, InfoboxTone>

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
    <div className={sectionCss}>
      {shown.map((alert) => (
        <Infobox
          key={alert.id}
          tone={widenedLookup(SEVERITY_TONES, alert.severity) ?? TONE.WARNING}
        >
          {alertSentence(t, alert.id, alert.count, alert.subject, alert.total)}
        </Infobox>
      ))}
      {rest.length > 0 && (
        <Disclosure title={t("credit-registration-alert-n-more", { count: rest.length })}>
          <ul className={dividedListCss}>
            {rest.map((alert) => (
              <li key={alert.id}>
                {alertSentence(t, alert.id, alert.count, alert.subject, alert.total)}
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </div>
  )
}

export default CreditRegistrationAlertBanner
