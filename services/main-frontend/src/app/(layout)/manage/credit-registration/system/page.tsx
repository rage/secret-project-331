"use client"

import { cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { useCreditRegistrationPhases } from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminPhaseActions from "@/components/credit-registration/admin/AdminPhaseActions"
import ApiLogSection from "@/components/credit-registration/admin/ApiLogSection"
import type { PhaseHealth } from "@/components/credit-registration/admin/phaseStatus"
import {
  countPhasesByHealth,
  phaseHealth,
} from "@/components/credit-registration/admin/phaseStatus"
import {
  MIDDLE_DOT,
  QUIET_REFRESH,
  TIME_IN_TITLE,
  TONE,
} from "@/components/credit-registration/constants"
import { widenedLookup } from "@/components/credit-registration/labelFrom"
import {
  dividedListCss,
  emptyStateCss,
  headingCss,
  monospaceCss,
  noteCss,
  proseCss,
  rowCss,
  sectionCss,
  sectionsCss,
  subheadingCss,
  subsectionCss,
} from "@/components/credit-registration/styles"
import type {
  CreditRegistrationPhaseList,
  CreditRegistrationPhaseRow,
} from "@/generated/api/types.generated"
import { includeIf } from "@/shared-module/common/utils/nullability"
import type { BadgeTone } from "@/shared-module/components"
import {
  Badge,
  Link,
  QueryResult,
  RelativeTime,
  StatTile,
  StatTileList,
} from "@/shared-module/components"

// oxlint-disable-next-line i18next/no-literal-string
const POD_STATUS_PATH = "/status"

const HEALTH_KEYS = {
  paused: "credit-registration-admin-phase-paused",
  not_built: "credit-registration-admin-phase-not-built",
  failing: "credit-registration-admin-phase-failing",
  heartbeat_late: "credit-registration-admin-phase-heartbeat-late",
  never_reported: "credit-registration-admin-phase-never-reported",
  running: "credit-registration-admin-phase-running",
} as const satisfies Record<PhaseHealth, string>

// A phase somebody stopped on purpose must not look like one that is broken.
const HEALTH_TONES = {
  paused: TONE.NEUTRAL,
  not_built: TONE.NEUTRAL,
  failing: TONE.DANGER,
  heartbeat_late: TONE.DANGER,
  never_reported: TONE.NEUTRAL,
  running: TONE.SUCCESS,
} as const satisfies Record<PhaseHealth, BadgeTone>

const PhaseRow: React.FC<{ phase: CreditRegistrationPhaseRow }> = ({ phase }) => {
  const { t } = useTranslation()
  const health = phaseHealth(phase)
  return (
    <li className={subsectionCss}>
      <div className={rowCss}>
        <code>{phase.phase}</code>
        <Badge tone={widenedLookup(HEALTH_TONES, health) ?? TONE.NEUTRAL}>
          {t(widenedLookup(HEALTH_KEYS, health) ?? HEALTH_KEYS.running)}
        </Badge>
        {phase.consecutive_failures > 0 && (
          <Badge tone={TONE.DANGER}>
            {t("credit-registration-admin-consecutive-failures", {
              count: phase.consecutive_failures,
            })}
          </Badge>
        )}
      </div>
      <p className={noteCss}>
        {t("credit-registration-admin-phase-last-run")}{" "}
        <RelativeTime at={phase.last_run_finished_at} absoluteTime={TIME_IN_TITLE} />
        {MIDDLE_DOT}
        {t("credit-registration-admin-phase-every", { seconds: phase.expected_interval_secs })}
        {phase.queue_depth !== null && phase.queue_depth !== undefined && (
          <>
            {MIDDLE_DOT}
            {t("credit-registration-admin-phase-queue", { count: phase.queue_depth })}
          </>
        )}
      </p>
      {phase.owned_states.length > 0 && <code>{phase.owned_states.join(MIDDLE_DOT)}</code>}
      {phase.last_error && <p className={cx(noteCss, monospaceCss)}>{phase.last_error}</p>}
      {phase.pause_reason && <p className={noteCss}>{phase.pause_reason}</p>}
      <AdminPhaseActions
        phase={phase.phase}
        paused={phase.paused_at !== null}
        implemented={phase.implemented}
      />
    </li>
  )
}

/** Rows arrive in process then pipeline order, so grouping is a fold rather than a sort. */
const groupByProcess = (
  phases: CreditRegistrationPhaseRow[],
): [string, CreditRegistrationPhaseRow[]][] => {
  const groups: [string, CreditRegistrationPhaseRow[]][] = []
  for (const phase of phases) {
    const last = groups.at(-1)
    if (last && last[0] === phase.process_name) {
      last[1].push(phase)
    } else {
      groups.push([phase.process_name, [phase]])
    }
  }
  return groups
}

const PhaseSection: React.FC<{ list: CreditRegistrationPhaseList }> = ({ list }) => {
  const { t } = useTranslation()
  const counts = countPhasesByHealth(list.phases)

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-phases")}</h2>
      <StatTileList ariaLabel={t("credit-registration-heading-phases")}>
        <StatTile label={t("credit-registration-admin-phase-running")} value={counts.running} />
        <StatTile
          label={t("credit-registration-admin-phase-heartbeat-late")}
          value={counts.heartbeat_late}
          {...includeIf(counts.heartbeat_late > 0, { tone: TONE.ALERT })}
        />
        <StatTile
          label={t("credit-registration-admin-phase-failing")}
          value={counts.failing}
          {...includeIf(counts.failing > 0, { tone: TONE.ALERT })}
        />
        <StatTile label={t("credit-registration-admin-phase-paused")} value={counts.paused} />
      </StatTileList>
      {list.paused_globally && (
        <div className={rowCss}>
          <Badge tone={TONE.NEUTRAL}>{t("credit-registration-admin-paused-globally")}</Badge>
        </div>
      )}
      {list.phases.length === 0 ? (
        <p className={emptyStateCss}>{t("credit-registration-admin-no-phases")}</p>
      ) : (
        groupByProcess(list.phases).map(([processName, phases]) => (
          <div key={processName} className={subsectionCss}>
            <h3 className={subheadingCss}>{processName}</h3>
            <ul className={dividedListCss}>
              {phases.map((phase) => (
                <PhaseRow key={phase.phase} phase={phase} />
              ))}
            </ul>
          </div>
        ))
      )}
      <p className={cx(noteCss, proseCss)}>
        {t("credit-registration-admin-phase-late-note", {
          multiplier: list.heartbeat_interval_multiplier,
          limit: list.consecutive_failure_limit,
        })}{" "}
        {t("credit-registration-admin-pause-is-our-flag-note")}{" "}
        <Link href={POD_STATUS_PATH}>{t("credit-registration-admin-open-pod-status")}</Link>
      </p>
    </section>
  )
}

/** The machinery: the phases that move the ledger, and the calls they make to the study registry. */
const SystemPage: React.FC = () => {
  const phasesQuery = useCreditRegistrationPhases()

  return (
    <div className={sectionsCss}>
      <QueryResult query={phasesQuery} refreshIndicator={QUIET_REFRESH}>
        {(list) => <PhaseSection list={list} />}
      </QueryResult>
      <ApiLogSection />
    </div>
  )
}

export default SystemPage
