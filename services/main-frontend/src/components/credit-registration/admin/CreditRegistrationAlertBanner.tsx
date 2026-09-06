"use client"

import { css, cx } from "@emotion/css"
import { ExclamationTriangle } from "@vectopus/atlas-icons-react"
import type { TFunction } from "i18next"
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
import { Disclosure, Infobox } from "@/shared-module/components"

import { PLAIN_DISCLOSURE, TONE } from "../constants"
import { dividedListCss, noteCss } from "../styles"
import { alertSentence } from "./adminCreditRegistrationCopy"
import { useCreditRegistrationOverview } from "./adminCreditRegistrationHooks"

const MINUTE_SECS = 60
const HOUR_SECS = 3600
const DAY_SECS = 86_400
const WARNING_ICON_SIZE = 16

const CRITICAL = "critical" as const
const INFO = "info" as const

const STUCK_QUERY = "?reason=stuck_in_state"
const MISREGISTERED_QUERY = "?reason=misregistered"
const PERMANENT_ERROR_QUERY = "?reason=permanent_error"

/**
 * Where each rule is acted on. An alert with no destination reads as a complaint the surface cannot
 * answer, and every rule here has a tab that shows the rows behind it.
 */
const ALERT_ROUTES = {
  credentials_rejected: creditRegistrationSystemRoute(),
  study_registry_unreachable: creditRegistrationSystemRoute(),
  sisu_unavailable: creditRegistrationSystemRoute(),
  stuck_registrations: `${creditRegistrationErrorsRoute()}${STUCK_QUERY}`,
  linking_mail_send_failed: creditRegistrationLinkingRoute(),
  linking_mail_rate_cap_exceeded: creditRegistrationLinkingRoute(),
  phase_heartbeat_stale: creditRegistrationSystemRoute(),
  phase_failing: creditRegistrationSystemRoute(),
  permanent_failures_accumulating: `${creditRegistrationErrorsRoute()}${PERMANENT_ERROR_QUERY}`,
  misregistrations_detected: `${creditRegistrationErrorsRoute()}${MISREGISTERED_QUERY}`,
  course_configuration_broken: creditRegistrationCoursesRoute(),
  pipeline_idle: creditRegistrationSystemRoute(),
  completions_never_entered: creditRegistrationOverviewRoute(),
  confirmation_latency_regressed: creditRegistrationSystemRoute(),
  fast_track_name_mismatch: creditRegistrationLinkingRoute(),
  pipeline_paused_globally: creditRegistrationSystemRoute(),
} as const satisfies Record<CreditRegistrationAlertId, string>

const bannerCss = css`
  display: grid;
  gap: var(--space-3);
`

const alertLineCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  align-items: baseline;
  justify-content: start;
`

const windowCaptionCss = css`
  white-space: nowrap;
`

/** One row per alert, whatever its severity: only the icon and the left rule carry the colour. */
const alertListCss = css`
  padding-left: 0;

  > li {
    display: flex;
    gap: var(--space-3);
    align-items: baseline;
    padding: var(--space-2) 0 var(--space-2) var(--space-3);
    border-left-style: solid;
    border-left-width: 3px;
    border-left-color: var(--alert-tone);
  }
`

const alertIconCss = css`
  flex: none;
  align-self: center;
  color: var(--alert-tone);
`

/** Sets `--alert-tone` on the row; the border rule above and `alertIconCss` both read it. */
const ALERT_TONE_CSS = {
  critical: css`
    --alert-tone: var(--color-crimson-700);
  `,
  warning: css`
    --alert-tone: var(--color-yellow-700);
  `,
} as const

/** A rule's window in words: it lands in a sentence, where "7 d" reads as a typo. */
const windowInWords = (t: TFunction, seconds: number): string => {
  if (seconds >= DAY_SECS) {
    return t("credit-registration-window-days", { count: Math.round(seconds / DAY_SECS) })
  }
  if (seconds >= HOUR_SECS) {
    return t("credit-registration-window-hours", { count: Math.round(seconds / HOUR_SECS) })
  }
  return t("credit-registration-window-minutes", {
    count: Math.max(1, Math.round(seconds / MINUTE_SECS)),
  })
}

/** One alert as a list row, coloured by severity on the icon and the rule beside it only. */
const AlertRow: React.FC<{ alert: CreditRegistrationAlert }> = ({ alert }) => {
  // oxlint-disable-next-line i18next/no-literal-string -- CSS lookup key, not user-facing text
  const tone = alert.severity === CRITICAL ? "critical" : "warning"
  return (
    <li className={ALERT_TONE_CSS[tone]}>
      <ExclamationTriangle className={alertIconCss} size={WARNING_ICON_SIZE} />
      <AlertLine alert={alert} />
    </li>
  )
}

const AlertLine: React.FC<{ alert: CreditRegistrationAlert }> = ({ alert }) => {
  const { t } = useTranslation()
  return (
    <span className={alertLineCss}>
      <Link href={ALERT_ROUTES[alert.id]} prefetch={false}>
        {alertSentence(t, alert.id, alert.count, alert.subject, alert.total)}
      </Link>
      {/* Without it, two rules counting the same thing over different windows read as a
          contradiction rather than as two measurements. */}
      {alert.window_secs !== null && alert.window_secs !== undefined && (
        <span className={cx(noteCss, windowCaptionCss)}>
          {t("credit-registration-alert-window", {
            window: windowInWords(t, alert.window_secs),
          })}
        </span>
      )}
    </span>
  )
}

const bySeverity = (alerts: CreditRegistrationAlert[], severity: CreditRegistrationAlertSeverity) =>
  alerts.filter((alert) => alert.severity === severity)

/**
 * Everything firing, worst first: what the Overview opens with.
 *
 * Only notices collapse. This is the one page whose job is to list what is wrong, so a warning
 * behind a toggle is a warning nobody reads.
 */
const FullBanner: React.FC<{ alerts: CreditRegistrationAlert[] }> = ({ alerts }) => {
  const { t } = useTranslation()
  const notices = bySeverity(alerts, INFO)
  const named = alerts.filter((alert) => alert.severity !== INFO)

  return (
    <div className={bannerCss}>
      {named.length > 0 && (
        <ul className={cx(dividedListCss, alertListCss)}>
          {named.map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </ul>
      )}
      {notices.length > 0 && (
        <Disclosure
          title={t("credit-registration-alert-n-notices", { count: notices.length })}
          variant={PLAIN_DISCLOSURE}
        >
          <ul className={dividedListCss}>
            {notices.map((alert) => (
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
 * registration are noise, but a working tab should still say what is on fire elsewhere — and say
 * it, rather than only counting it, while there is one thing to name.
 */
const SummaryStrip: React.FC<{ alerts: CreditRegistrationAlert[] }> = ({ alerts }) => {
  const { t } = useTranslation()
  const criticals = bySeverity(alerts, CRITICAL)
  // The one thing on fire gets named; several get counted, because naming the first of five picks
  // for the reader.
  const namedOne =
    criticals.length === 1 ? criticals[0] : alerts.length === 1 ? alerts[0] : undefined
  const rest = alerts.length - 1

  if (namedOne) {
    return (
      <Infobox tone={criticals.length === 1 ? TONE.DANGER : TONE.WARNING}>
        <span className={alertLineCss}>
          <AlertLine alert={namedOne} />
          {rest > 0 && (
            <Link href={creditRegistrationOverviewRoute()} prefetch={false}>
              {t("credit-registration-alert-n-more", { count: rest })}
            </Link>
          )}
        </span>
      </Infobox>
    )
  }

  return (
    <Infobox tone={criticals.length > 0 ? TONE.DANGER : TONE.WARNING}>
      <span className={alertLineCss}>
        <span>
          {criticals.length === 0
            ? t("credit-registration-alert-summary-warnings", { count: alerts.length })
            : t("credit-registration-alert-summary", {
                critical: criticals.length,
                warnings: alerts.length - criticals.length,
              })}
        </span>
        <Link href={creditRegistrationOverviewRoute()} prefetch={false}>
          {t("credit-registration-alert-see-overview")}
        </Link>
      </span>
    </Infobox>
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
  // One registration's page is about that row — except for a critical, which is why the action on
  // it will not work.
  if (pathname?.startsWith(`${creditRegistrationRegistrationsRoute()}/`)) {
    const criticals = bySeverity(alerts, CRITICAL)
    if (criticals.length === 0) {
      return null
    }
    return (
      <Infobox tone={TONE.DANGER}>
        <span className={bannerCss}>
          {criticals.map((alert) => (
            <AlertLine key={alert.id} alert={alert} />
          ))}
        </span>
      </Infobox>
    )
  }
  return pathname === creditRegistrationOverviewRoute() ? (
    <FullBanner alerts={alerts} />
  ) : (
    <SummaryStrip alerts={alerts} />
  )
}

export default CreditRegistrationAlertBanner
