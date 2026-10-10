"use client"

import { css, cx } from "@emotion/css"
import { ExclamationTriangle } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import type {
  CreditRegistrationAlert,
  CreditRegistrationAlertId,
  CreditRegistrationAlertSeverity,
} from "@/generated/api/types.generated"
import {
  creditRegistrationCoursesRoute,
  creditRegistrationEnrolmentChecksRoute,
  creditRegistrationLinkingRoute,
  creditRegistrationOverviewRoute,
  creditRegistrationSystemRoute,
} from "@/shared-module/common/utils/routes"
import { Disclosure, Link as ActionLink } from "@/shared-module/components"

import {
  BUTTON_SECONDARY,
  BUTTON_SMALL,
  CREDIT_REGISTRATION_NS,
  PLAIN_DISCLOSURE,
} from "../constants"
import { dividedListCss, noteCss } from "../styles"
import { alertSentence } from "./adminCreditRegistrationCopy"
import { useCreditRegistrationOverview } from "./adminCreditRegistrationHooks"
import { attentionPhaseAnchorId, needsAttentionHref } from "./adminLinks"
import { registrationsListHref } from "./registrationsListUrl"

const WARNING_ICON_SIZE = 20

const CRITICAL = "critical" as const
const INFO = "info" as const

/** Where each rule is acted on; every alert needs a destination. */
const ALERT_ROUTES = {
  credentials_rejected: creditRegistrationSystemRoute(),
  study_registry_unreachable: creditRegistrationSystemRoute(),
  service_unavailable: creditRegistrationSystemRoute(),
  stuck_registrations: registrationsListHref({
    attentionReasons: ["stuck_in_state"],
    includeNotStarted: true,
  }),
  linking_mail_send_failed: creditRegistrationLinkingRoute(),
  linking_mail_rate_cap_exceeded: creditRegistrationLinkingRoute(),
  phase_heartbeat_stale: creditRegistrationSystemRoute(),
  phase_failing: creditRegistrationSystemRoute(),
  permanent_failures_accumulating: needsAttentionHref(attentionPhaseAnchorId("registering")),
  misregistrations_detected: needsAttentionHref(attentionPhaseAnchorId("confirmation")),
  course_configuration_broken: creditRegistrationCoursesRoute(),
  pipeline_idle: creditRegistrationSystemRoute(),
  completions_never_entered: creditRegistrationOverviewRoute(),
  confirmation_latency_regressed: creditRegistrationSystemRoute(),
  pipeline_paused_globally: creditRegistrationSystemRoute(),
  study_registry_student_number_conflicts: creditRegistrationLinkingRoute(),
  roster_course_code_failing: creditRegistrationEnrolmentChecksRoute(),
} as const satisfies Record<CreditRegistrationAlertId, string>

const bannerCss = css`
  display: grid;
  gap: var(--space-3);
`

/** One card per alert: the sentence and the way to act on it. */
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
 * Icon and sentence as one flex child, so the action is what wraps to its own line. The basis makes
 * that happen before the sentence is squeezed three lines deep on a phone.
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

/** A card's contents: glyph and sentence as one group, then the action. */
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

/** One alert as a card. The sentence is not the link; one button per card is. */
const AlertRow: React.FC<{ alert: CreditRegistrationAlert }> = ({ alert }) => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  // oxlint-disable-next-line i18next/no-literal-string -- CSS lookup key, not user-facing text
  const tone = alert.severity === CRITICAL ? "critical" : "warning"
  const sentence = alertSentence(t, alert, i18n.language)

  return (
    <li className={cx(alertCardCss, ALERT_TONE_CSS[tone])}>
      <AlertCardContent action={<AlertOpenLink alert={alert} sentence={sentence} />}>
        <p className={alertSentenceCss}>{sentence}</p>
      </AlertCardContent>
    </li>
  )
}

const AlertLine: React.FC<{ alert: CreditRegistrationAlert }> = ({ alert }) => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <ActionLink href={ALERT_ROUTES[alert.id]} prefetch={false}>
      {alertSentence(t, alert, i18n.language)}
    </ActionLink>
  )
}

const bySeverity = (alerts: CreditRegistrationAlert[], severity: CreditRegistrationAlertSeverity) =>
  alerts.filter((alert) => alert.severity === severity)

/**
 * Everything firing, worst first, as the Overview's opening content.
 *
 * Uncarded and unheaded: the cards already say what they are. The list keeps an accessible name in
 * place of the heading, and no tile row repeats the tab strip's counts.
 *
 * Only notices collapse; a warning behind a toggle goes unread.
 */
export const CreditRegistrationAttentionSection: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const overviewQuery = useCreditRegistrationOverview()
  const alerts = overviewQuery.data?.health.alerts ?? []
  const notices = bySeverity(alerts, INFO)
  const named = alerts.filter((alert) => alert.severity !== INFO)

  if (named.length === 0 && notices.length === 0) {
    // With anything on the queue, the tab strip's Needs attention count already says so.
    return overviewQuery.data?.needs_attention_count === 0 ? (
      <p className={noteCss}>{t("credit-registration-admin-nothing-needs-a-human")}</p>
    ) : null
  }
  return (
    <div className={bannerCss}>
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
