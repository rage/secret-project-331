"use client"

import { css, cx } from "@emotion/css"
import Link from "next/link"
import { usePathname } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import type {
  CreditRegistrationAlert,
  CreditRegistrationAlertId,
  CreditRegistrationAlertSeverity,
} from "@/generated/api/types.generated"
import {
  creditRegistrationCoursesRoute,
  creditRegistrationErrorsRoute,
  creditRegistrationLinkingRoute,
  creditRegistrationOverviewRoute,
  creditRegistrationRegistrationsRoute,
  creditRegistrationSystemRoute,
} from "@/shared-module/common/utils/routes"
import type { InfoboxTone } from "@/shared-module/components"
import { Disclosure, Infobox } from "@/shared-module/components"
import { formatDuration } from "@/utils/moduleTimeline"

import { MIDDLE_DOT, TONE } from "../constants"
import { widenedLookup } from "../labelFrom"
import { dividedListCss, noteCss, rowCss, sectionCss } from "../styles"
import { alertSentence } from "./adminCreditRegistrationCopy"
import { useCreditRegistrationOverview } from "./adminCreditRegistrationHooks"

const MAX_SHOWN = 3

const SEVERITY_TONES = {
  critical: TONE.DANGER,
  warning: TONE.WARNING,
  info: TONE.INFO,
} as const satisfies Record<CreditRegistrationAlertSeverity, InfoboxTone>

// oxlint-disable-next-line i18next/no-literal-string
const STUCK_QUERY = "?reason=stuck_in_state"
// oxlint-disable-next-line i18next/no-literal-string
const MISREGISTERED_QUERY = "?reason=misregistered"
// oxlint-disable-next-line i18next/no-literal-string
const PERMANENT_ERROR_QUERY = "?reason=permanent_error"

/**
 * Where each rule is acted on. An alert with no destination reads as a complaint the surface cannot
 * answer, and every rule here has a tab that shows the rows behind it.
 */
const ALERT_ROUTES = {
  credentials_rejected: () => creditRegistrationSystemRoute(),
  study_registry_unreachable: () => creditRegistrationSystemRoute(),
  sisu_unavailable: () => creditRegistrationSystemRoute(),
  stuck_registrations: () => `${creditRegistrationErrorsRoute()}${STUCK_QUERY}`,
  linking_mail_send_failed: () => creditRegistrationLinkingRoute(),
  linking_mail_rate_cap_exceeded: () => creditRegistrationLinkingRoute(),
  phase_heartbeat_stale: () => creditRegistrationSystemRoute(),
  phase_failing: () => creditRegistrationSystemRoute(),
  permanent_failures_accumulating: () =>
    `${creditRegistrationErrorsRoute()}${PERMANENT_ERROR_QUERY}`,
  misregistrations_detected: () => `${creditRegistrationErrorsRoute()}${MISREGISTERED_QUERY}`,
  course_configuration_broken: () => creditRegistrationCoursesRoute(),
  pipeline_idle: () => creditRegistrationSystemRoute(),
  completions_never_entered: () => creditRegistrationErrorsRoute(),
  confirmation_latency_regressed: () => creditRegistrationSystemRoute(),
  fast_track_name_mismatch: () => creditRegistrationLinkingRoute(),
  pipeline_paused_globally: () => creditRegistrationSystemRoute(),
} as const satisfies Record<CreditRegistrationAlertId, () => string>

const summaryStripCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  align-items: baseline;
  padding: var(--space-3) var(--space-4);
  border-left: 3px solid var(--color-gray-300);
  border-radius: 0 var(--surface-radius) var(--surface-radius) 0;
  background: var(--color-gray-50);
  font-size: var(--font-size-1);
`

const AlertLine: React.FC<{ alert: CreditRegistrationAlert }> = ({ alert }) => {
  const { t } = useTranslation()
  return (
    <span className={rowCss}>
      <Link href={ALERT_ROUTES[alert.id]()} prefetch={false}>
        {alertSentence(t, alert.id, alert.count, alert.subject, alert.total)}
      </Link>
      {/* Without it, two rules counting the same thing over different windows read as a
          contradiction rather than as two measurements. */}
      {alert.window_secs !== null && alert.window_secs !== undefined && (
        <span className={noteCss}>
          {t("credit-registration-alert-window", {
            window: formatDuration(alert.window_secs, t),
          })}
        </span>
      )}
    </span>
  )
}

/** Everything firing, worst first: what the Overview opens with. */
const FullBanner: React.FC<{ alerts: CreditRegistrationAlert[] }> = ({ alerts }) => {
  const { t } = useTranslation()
  const shown = alerts.slice(0, MAX_SHOWN)
  const rest = alerts.slice(MAX_SHOWN)

  return (
    <div className={sectionCss}>
      {shown.map((alert) => (
        <Infobox
          key={alert.id}
          tone={widenedLookup(SEVERITY_TONES, alert.severity) ?? TONE.WARNING}
        >
          <AlertLine alert={alert} />
        </Infobox>
      ))}
      {rest.length > 0 && (
        <Disclosure title={t("credit-registration-alert-n-more", { count: rest.length })}>
          <ul className={dividedListCss}>
            {rest.map((alert) => (
              <li key={alert.id}>
                <AlertLine alert={alert} />
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </div>
  )
}

/**
 * One line on the tabs that are not the Overview: five system-wide problems above a page about one
 * registration are noise, but a working tab should still say that something is on fire elsewhere.
 */
const SummaryStrip: React.FC<{ alerts: CreditRegistrationAlert[] }> = ({ alerts }) => {
  const { t } = useTranslation()
  const critical = alerts.filter((alert) => alert.severity === "critical").length
  const warnings = alerts.length - critical
  return (
    <p className={cx(summaryStripCss, noteCss)}>
      <span>
        {t("credit-registration-alert-summary", { critical, warnings })}
        {MIDDLE_DOT}
      </span>
      <Link href={creditRegistrationOverviewRoute()} prefetch={false}>
        {t("credit-registration-alert-see-overview")}
      </Link>
    </p>
  )
}

/** The health rules that are firing right now, weighted by how much of the tab they deserve. */
const CreditRegistrationAlertBanner: React.FC = () => {
  const pathname = usePathname()
  const overviewQuery = useCreditRegistrationOverview()
  const alerts = overviewQuery.data?.health.alerts ?? []
  if (alerts.length === 0) {
    return null
  }
  // An operator who followed a link to one registration came to read that row, not the pipeline.
  if (pathname?.startsWith(`${creditRegistrationRegistrationsRoute()}/`)) {
    return null
  }
  return pathname === creditRegistrationOverviewRoute() ? (
    <FullBanner alerts={alerts} />
  ) : (
    <SummaryStrip alerts={alerts} />
  )
}

export default CreditRegistrationAlertBanner
