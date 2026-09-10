"use client"

import { css, cx } from "@emotion/css"
import { ExclamationTriangle } from "@vectopus/atlas-icons-react"
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
import { Disclosure, Link as ActionLink } from "@/shared-module/components"

import {
  BUTTON_SECONDARY,
  BUTTON_SMALL,
  CREDIT_REGISTRATION_NS,
  PLAIN_DISCLOSURE,
} from "../constants"
import type { CreditRegistrationTFunction } from "../constants"
import { dividedListCss, emptyStateCss, noteCss } from "../styles"
import { alertSentence } from "./adminCreditRegistrationCopy"
import { useCreditRegistrationOverview } from "./adminCreditRegistrationHooks"

const MINUTE_SECS = 60
const HOUR_SECS = 3600
const DAY_SECS = 86_400
const WARNING_ICON_SIZE = 20

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

/** One card per alert: the sentence, the window it was measured over, and the way to act on it. */
const alertCardsCss = css`
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
`

const alertCardCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-4);
  /* Anchors the icon and the action to the sentence's first line; centring strands them beside the
     middle of a sentence that wraps to three lines at phone width. */
  align-items: flex-start;
  padding: var(--space-4);
  border: 1px solid var(--alert-edge);
  /* Thicker on the reading edge, so a column of cards ranks itself down the left. */
  border-left-width: 4px;
  border-radius: var(--surface-radius);
  background: var(--alert-ground);
`

/**
 * Icon and sentence as one flex child, so the two can never be split across lines and it is the
 * action that drops to a line of its own when the card runs out of room. Sized so that happens
 * before the sentence is squeezed into a column three lines deep on a phone.
 */
const alertMainCss = css`
  flex: 1 1 20rem;
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
`

const alertBodyCss = css`
  display: grid;
  gap: var(--space-1);
  min-width: 0;
`

const alertSentenceCss = css`
  margin: 0;
  color: var(--color-gray-700);
  font-size: var(--font-size-2);
  font-weight: 600;
`

const alertActionCss = css`
  flex: none;
`

const alertIconCss = css`
  flex: none;
  /* Optically centres the glyph on the first line, which is taller than the glyph itself. */
  margin-top: var(--space-1);
  color: var(--alert-icon);
`

/** Sets the card's three tone slots. Matches `Infobox`, so a card and an in-page notice on the
 *  same tab are not two vocabularies of tint. */
const ALERT_TONE_CSS = {
  critical: css`
    --alert-ground: var(--color-crimson-75);
    --alert-edge: var(--color-crimson-600);
    --alert-icon: var(--color-crimson-600);
  `,
  warning: css`
    --alert-ground: var(--color-yellow-100);
    --alert-edge: var(--color-yellow-700);
    /* The yellow ramp is not contrast-safe as ink, so the glyph stays grey and the fill is what
       carries the severity. */
    --alert-icon: var(--color-gray-700);
  `,
} as const

/** A rule's window in words: it lands in a sentence, where "7 d" reads as a typo. */
const windowInWords = (t: CreditRegistrationTFunction, seconds: number): string => {
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

/**
 * The window a rule was measured over. Without it, two rules counting the same thing over
 * different windows read as a contradiction rather than as two measurements.
 */
const AlertWindowCaption: React.FC<{ windowSecs: number | null | undefined }> = ({
  windowSecs,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  if (windowSecs === null || windowSecs === undefined) {
    return null
  }
  return (
    <span className={cx(noteCss, windowCaptionCss)}>
      {t("credit-registration-alert-window", { window: windowInWords(t, windowSecs) })}
    </span>
  )
}

/** Opens the tab a rule is acted on. Every card's button says "Open", so the accessible name is
 *  what carries which alert it opens. */
const AlertOpenLink: React.FC<{ alert: CreditRegistrationAlert; sentence: string }> = ({
  alert,
  sentence,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <ActionLink
      href={ALERT_ROUTES[alert.id]}
      prefetch={false}
      styledAsButton
      variant={BUTTON_SECONDARY}
      size={BUTTON_SMALL}
      className={alertActionCss}
      aria-label={t("credit-registration-alert-open-named", { alert: sentence })}
    >
      {t("credit-registration-alert-open")}
    </ActionLink>
  )
}

/**
 * A card's contents: the glyph and what it says as one group that cannot be split
 * across lines, then the one way to act on it. The element and the tone are the caller's — a list
 * item where every rule is listed, a lone panel where they are summarised.
 */
const AlertCardContent: React.FC<{ action: React.ReactNode; children: React.ReactNode }> = ({
  action,
  children,
}) => (
  <>
    <div className={alertMainCss}>
      <ExclamationTriangle className={alertIconCss} size={WARNING_ICON_SIZE} aria-hidden="true" />
      <div className={alertBodyCss}>{children}</div>
    </div>
    {action}
  </>
)

/**
 * One alert as a card. The sentence is not itself the link: five underlined sentences read as a
 * page of links, where one button per card says there is one thing to do with each.
 */
const AlertRow: React.FC<{ alert: CreditRegistrationAlert }> = ({ alert }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  // oxlint-disable-next-line i18next/no-literal-string -- CSS lookup key, not user-facing text
  const tone = alert.severity === CRITICAL ? "critical" : "warning"
  const sentence = alertSentence(t, alert.id, alert.count, alert.subject, alert.total)

  return (
    <li className={cx(alertCardCss, ALERT_TONE_CSS[tone])}>
      <AlertCardContent action={<AlertOpenLink alert={alert} sentence={sentence} />}>
        <p className={alertSentenceCss}>{sentence}</p>
        <AlertWindowCaption windowSecs={alert.window_secs} />
      </AlertCardContent>
    </li>
  )
}

const AlertLine: React.FC<{ alert: CreditRegistrationAlert }> = ({ alert }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <span className={alertLineCss}>
      <Link href={ALERT_ROUTES[alert.id]} prefetch={false}>
        {alertSentence(t, alert.id, alert.count, alert.subject, alert.total)}
      </Link>
      <AlertWindowCaption windowSecs={alert.window_secs} />
    </span>
  )
}

const bySeverity = (alerts: CreditRegistrationAlert[], severity: CreditRegistrationAlertSeverity) =>
  alerts.filter((alert) => alert.severity === severity)

/**
 * Everything firing, worst first, as the Overview's opening content.
 *
 * Uncarded and unheaded: the cards are already tinted panels that say what they are, so a frame
 * and a title around them only add chrome to the first thing a reader looks at. The list keeps an
 * accessible name in place of the heading. The tab strip carries the standing counts, so a tile
 * row here would only repeat them under labels identical to the tabs' own.
 *
 * Only notices collapse. This is the one page whose job is to list what is wrong, so a warning
 * behind a toggle is a warning nobody reads.
 */
export const CreditRegistrationAttentionSection: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const overviewQuery = useCreditRegistrationOverview()
  const alerts = overviewQuery.data?.health.alerts ?? []
  const notices = bySeverity(alerts, INFO)
  const named = alerts.filter((alert) => alert.severity !== INFO)

  return (
    <div className={bannerCss}>
      {named.length === 0 && notices.length === 0 && (
        <p className={emptyStateCss}>{t("credit-registration-admin-nothing-needs-a-human")}</p>
      )}
      {named.length > 0 && (
        <ul className={alertCardsCss} aria-label={t("credit-registration-heading-needs-attention")}>
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
 * One card on the tabs that are not the Overview: five system-wide problems above a page about one
 * registration are noise, but a working tab should still say what is on fire elsewhere — and say
 * it, rather than only counting it, while there is one thing to name.
 */
const SummaryStrip: React.FC<{ alerts: CreditRegistrationAlert[] }> = ({ alerts }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const criticals = bySeverity(alerts, CRITICAL)
  // The one thing on fire gets named; several get counted, because naming the first of five picks
  // for the reader.
  const namedOne =
    criticals.length === 1 ? criticals[0] : alerts.length === 1 ? alerts[0] : undefined
  const rest = alerts.length - 1
  // oxlint-disable-next-line i18next/no-literal-string -- CSS lookup key, not user-facing text
  const tone = criticals.length > 0 ? "critical" : "warning"

  if (namedOne) {
    const sentence = alertSentence(t, namedOne.id, namedOne.count, namedOne.subject, namedOne.total)
    return (
      <div className={cx(alertCardCss, ALERT_TONE_CSS[tone])}>
        <AlertCardContent action={<AlertOpenLink alert={namedOne} sentence={sentence} />}>
          <p className={alertSentenceCss}>{sentence}</p>
          {rest > 0 ? (
            <span className={alertLineCss}>
              <AlertWindowCaption windowSecs={namedOne.window_secs} />
              <Link href={creditRegistrationOverviewRoute()} prefetch={false}>
                {t("credit-registration-alert-n-more", { count: rest })}
              </Link>
            </span>
          ) : (
            <AlertWindowCaption windowSecs={namedOne.window_secs} />
          )}
        </AlertCardContent>
      </div>
    )
  }

  return (
    <div className={cx(alertCardCss, ALERT_TONE_CSS[tone])}>
      <AlertCardContent
        action={
          <ActionLink
            href={creditRegistrationOverviewRoute()}
            prefetch={false}
            styledAsButton
            variant={BUTTON_SECONDARY}
            size={BUTTON_SMALL}
            className={alertActionCss}
          >
            {t("credit-registration-alert-see-overview")}
          </ActionLink>
        }
      >
        <p className={alertSentenceCss}>
          {criticals.length === 0
            ? t("credit-registration-alert-summary-warnings", { count: alerts.length })
            : t("credit-registration-alert-summary", {
                critical: criticals.length,
                warnings: alerts.length - criticals.length,
              })}
        </p>
      </AlertCardContent>
    </div>
  )
}

/** The health rules that are firing right now, weighted by how much of the tab they deserve. */
const CreditRegistrationAlertBanner: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const pathname = usePathname()
  const overviewQuery = useCreditRegistrationOverview()
  const alerts = overviewQuery.data?.health.alerts ?? []
  if (alerts.length === 0) {
    return null
  }
  // One registration's page is about that row — except when it's critical, since then the row's
  // own action cannot fix it either.
  if (pathname?.startsWith(`${creditRegistrationRegistrationsRoute()}/`)) {
    const criticals = bySeverity(alerts, CRITICAL)
    if (criticals.length === 0) {
      return null
    }
    return (
      <ul className={alertCardsCss} aria-label={t("credit-registration-heading-needs-attention")}>
        {criticals.map((alert) => (
          <AlertRow key={alert.id} alert={alert} />
        ))}
      </ul>
    )
  }
  // The Overview lists every rule in its own section, so a strip above it would say it twice.
  if (pathname === creditRegistrationOverviewRoute()) {
    return null
  }
  return <SummaryStrip alerts={alerts} />
}

export default CreditRegistrationAlertBanner
