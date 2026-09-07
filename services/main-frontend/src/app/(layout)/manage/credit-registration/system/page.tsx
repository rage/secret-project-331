"use client"

import { cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { useCreditRegistrationPhases } from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminPhaseActions from "@/components/credit-registration/admin/AdminPhaseActions"
import ApiLogSection from "@/components/credit-registration/admin/ApiLogSection"
import EndpointSummarySection from "@/components/credit-registration/admin/EndpointSummarySection"
import {
  countPhasesByHealth,
  formatIntervalSecs,
  isUnhealthyPhase,
  phaseHealth,
  phaseHealthLabel,
} from "@/components/credit-registration/admin/phaseStatus"
import {
  ABSENT,
  ALIGN_END,
  DENSITY_COMPACT,
  MIDDLE_DOT,
  QUIET_REFRESH,
  TABLE_STACK,
  TIME_COMPACT,
  TONE,
} from "@/components/credit-registration/constants"
import { registrationLedgerStateLabel } from "@/components/credit-registration/creditRegistrationCopy"
import {
  headingCss,
  monospaceCss,
  noteCss,
  proseCss,
  rowCss,
  sectionCardCss,
  sectionCardHeaderCss,
  sectionCardsCss,
  sectionHeaderCss,
  stackedCellCss,
  subheadingCss,
  subsectionCss,
} from "@/components/credit-registration/styles"
import type {
  CreditRegistrationPhaseList,
  CreditRegistrationPhaseRow,
} from "@/generated/api/types.generated"
import {
  Badge,
  Link,
  QueryResult,
  RelativeTime,
  StatTile,
  StatTileList,
  Table,
  Tooltip,
} from "@/shared-module/components"

const SERVER_STATUS_PATH = "/status"

const PhaseTable: React.FC<{
  phases: CreditRegistrationPhaseRow[]
  caption: string
}> = ({ phases, caption }) => {
  const { t } = useTranslation()
  return (
    <Table
      caption={caption}
      density={DENSITY_COMPACT}
      responsive={TABLE_STACK}
      rowKey={(row) => row.phase}
      rows={phases}
      columns={[
        {
          header: t("credit-registration-admin-column-phase"),
          minWidth: "12rem",
          cell: (row) => (
            <span className={rowCss}>
              <code>{row.phase}</code>
              {row.owned_states.length > 0 && (
                <Tooltip
                  aria-label={t("credit-registration-admin-owned-states-tooltip-label", {
                    phase: row.phase,
                  })}
                >
                  {t("credit-registration-admin-owned-states-tooltip-body", {
                    states: row.owned_states
                      .map((state) => registrationLedgerStateLabel(t, state))
                      .join(MIDDLE_DOT),
                  })}
                </Tooltip>
              )}
            </span>
          ),
        },
        {
          header: t("label-status"),
          minWidth: "11rem",
          cell: (row) => {
            const health = phaseHealth(row)
            // `failing` already implies at least one consecutive failure, so the count badge
            // carries the health label too rather than doubling up on red.
            const failing = health === "failing"
            return (
              <span className={stackedCellCss}>
                {isUnhealthyPhase(health) ? (
                  <Badge tone={TONE.DANGER} size="compact">
                    {failing
                      ? t("credit-registration-admin-consecutive-failures", {
                          count: row.consecutive_failures,
                        })
                      : phaseHealthLabel(t, health)}
                  </Badge>
                ) : (
                  <span>{phaseHealthLabel(t, health)}</span>
                )}
                {!failing && row.consecutive_failures > 0 && (
                  <span className={noteCss}>
                    {t("credit-registration-admin-consecutive-failures", {
                      count: row.consecutive_failures,
                    })}
                  </span>
                )}
                {row.last_error && (
                  <span className={cx(noteCss, monospaceCss)}>{row.last_error}</span>
                )}
                {row.pause_reason && <span className={noteCss}>{row.pause_reason}</span>}
              </span>
            )
          },
        },
        {
          header: t("credit-registration-admin-phase-last-run"),
          minWidth: "8rem",
          nowrap: true,
          cell: (row) => <RelativeTime at={row.last_run_finished_at} absoluteTime={TIME_COMPACT} />,
        },
        {
          header: t("credit-registration-admin-column-due"),
          minWidth: "13rem",
          cell: (row) => {
            const elapsed = row.seconds_since_heartbeat
            return (
              <span className={noteCss}>
                {elapsed === null || elapsed === undefined
                  ? ABSENT
                  : t("credit-registration-admin-heartbeat-progress", {
                      elapsed: formatIntervalSecs(elapsed, t),
                      interval: formatIntervalSecs(row.expected_interval_secs, t),
                    })}
              </span>
            )
          },
        },
        {
          header: t("credit-registration-admin-column-queue"),
          align: ALIGN_END,
          minWidth: "5rem",
          nowrap: true,
          cell: (row) => row.queue_depth ?? ABSENT,
        },
        {
          header: t("label-actions"),
          minWidth: "4rem",
          cell: (row) => (
            <AdminPhaseActions
              phase={row.phase}
              paused={row.paused_at !== null}
              implemented={row.implemented}
            />
          ),
        },
      ]}
    />
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
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-phases")}</h2>
      </div>
      <p className={cx(noteCss, proseCss)}>
        {t("credit-registration-admin-phase-late-note", {
          multiplier: list.heartbeat_interval_multiplier,
          limit: list.consecutive_failure_limit,
        })}{" "}
        {t("credit-registration-admin-pause-is-our-flag-note")}{" "}
        <Link href={SERVER_STATUS_PATH}>{t("credit-registration-admin-open-pod-status")}</Link>
      </p>
      {/* Failing and heartbeat-late counts are the System tab badge's own number; repeating them
          here would just be that badge restated. Running and paused are not shown anywhere else. */}
      <StatTileList ariaLabel={t("credit-registration-heading-phases")}>
        <StatTile label={t("credit-registration-admin-phase-running")} value={counts.running} />
        <StatTile label={t("credit-registration-admin-phase-paused")} value={counts.paused} />
      </StatTileList>
      {list.paused_globally && (
        <div className={rowCss}>
          <Badge tone={TONE.DANGER}>{t("credit-registration-admin-paused-globally")}</Badge>
        </div>
      )}
      {groupByProcess(list.phases).map(([processName, phases]) => (
        <div key={processName} className={subsectionCss}>
          <div className={sectionHeaderCss}>
            <h3 className={subheadingCss}>{processName}</h3>
            <p className={noteCss}>{t("credit-registration-admin-process-group-note")}</p>
          </div>
          <PhaseTable phases={phases} caption={processName} />
        </div>
      ))}
      {list.phases.length === 0 && (
        <p className={noteCss}>{t("credit-registration-admin-no-phases")}</p>
      )}
    </section>
  )
}

/** The machinery: the phases that move the ledger, and the calls they make to the study registry. */
const SystemPage: React.FC = () => {
  const phasesQuery = useCreditRegistrationPhases()

  return (
    <div className={sectionCardsCss}>
      <QueryResult query={phasesQuery} refreshIndicator={QUIET_REFRESH}>
        {(list) => <PhaseSection list={list} />}
      </QueryResult>
      <EndpointSummarySection />
      <ApiLogSection />
    </div>
  )
}

export default SystemPage
