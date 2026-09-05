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
  phaseHealth,
  phaseHealthLabel,
  phaseHealthTone,
} from "@/components/credit-registration/admin/phaseStatus"
import {
  ABSENT,
  ALIGN_END,
  DENSITY_COMPACT,
  MIDDLE_DOT,
  QUIET_REFRESH,
  TIME_COMPACT,
  TONE,
} from "@/components/credit-registration/constants"
import {
  headingCss,
  monospaceCss,
  noteCss,
  proseCss,
  rowCss,
  sectionCss,
  sectionHeaderCss,
  spacedRowCss,
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
  Meter,
  QueryResult,
  RelativeTime,
  StatTile,
  StatTileList,
  Table,
} from "@/shared-module/components"

// oxlint-disable-next-line i18next/no-literal-string
const POD_STATUS_PATH = "/status"

/**
 * How overdue a phase is, as a share of the interval it is allowed to be silent for. The tick marks
 * one ordinary tick, so a bar past it is a phase that has missed one and a full bar is a late one.
 */
const HeartbeatMeter: React.FC<{
  phase: CreditRegistrationPhaseRow
  lateMultiplier: number
}> = ({ phase, lateMultiplier }) => {
  const { t } = useTranslation()
  const elapsed = phase.seconds_since_heartbeat
  if (elapsed === null || elapsed === undefined) {
    return <span className={noteCss}>{ABSENT}</span>
  }
  return (
    <Meter
      value={elapsed}
      maxValue={phase.expected_interval_secs * lateMultiplier}
      threshold={phase.expected_interval_secs}
      showLabel={false}
      tone={phase.heartbeat_late ? TONE.DANGER : TONE.SUCCESS}
      label={t("credit-registration-admin-heartbeat-progress", {
        elapsed: formatIntervalSecs(elapsed, t),
        interval: formatIntervalSecs(phase.expected_interval_secs, t),
      })}
    />
  )
}

const PhaseTable: React.FC<{
  phases: CreditRegistrationPhaseRow[]
  lateMultiplier: number
  caption: string
}> = ({ phases, lateMultiplier, caption }) => {
  const { t } = useTranslation()
  return (
    <Table
      caption={caption}
      density={DENSITY_COMPACT}
      rowKey={(row) => row.phase}
      rows={phases}
      columns={[
        {
          header: t("credit-registration-admin-column-phase"),
          minWidth: "12rem",
          cell: (row) => <code>{row.phase}</code>,
        },
        {
          header: t("label-status"),
          minWidth: "11rem",
          cell: (row) => {
            const health = phaseHealth(row)
            return (
              <span className={stackedCellCss}>
                <span className={rowCss}>
                  <Badge tone={phaseHealthTone(health)} size="compact">
                    {phaseHealthLabel(t, health)}
                  </Badge>
                  {row.consecutive_failures > 0 && (
                    <Badge tone={TONE.DANGER} size="compact">
                      {t("credit-registration-admin-consecutive-failures", {
                        count: row.consecutive_failures,
                      })}
                    </Badge>
                  )}
                </span>
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
          minWidth: "9rem",
          cell: (row) => (
            <span className={stackedCellCss}>
              <span className={noteCss}>
                {t("credit-registration-admin-phase-every", {
                  interval: formatIntervalSecs(row.expected_interval_secs, t),
                })}
              </span>
              <HeartbeatMeter phase={row} lateMultiplier={lateMultiplier} />
            </span>
          ),
        },
        {
          header: t("credit-registration-admin-column-queue"),
          align: ALIGN_END,
          minWidth: "5rem",
          nowrap: true,
          cell: (row) => row.queue_depth ?? ABSENT,
        },
        {
          header: t("credit-registration-admin-column-owned-states"),
          grow: true,
          minWidth: "12rem",
          nowrap: false,
          cell: (row) =>
            row.owned_states.length === 0 ? (
              ABSENT
            ) : (
              <code>{row.owned_states.join(MIDDLE_DOT)}</code>
            ),
        },
        {
          header: t("label-actions"),
          minWidth: "9rem",
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
    <section className={sectionCss}>
      <div className={spacedRowCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-phases")}</h2>
        <Link href={POD_STATUS_PATH}>{t("credit-registration-admin-open-pod-status")}</Link>
      </div>
      <p className={cx(noteCss, proseCss)}>
        {t("credit-registration-admin-phase-late-note", {
          multiplier: list.heartbeat_interval_multiplier,
          limit: list.consecutive_failure_limit,
        })}{" "}
        {t("credit-registration-admin-pause-is-our-flag-note")}
      </p>
      <StatTileList ariaLabel={t("credit-registration-heading-phases")}>
        <StatTile label={t("credit-registration-admin-phase-running")} value={counts.running} />
        <StatTile
          label={t("credit-registration-admin-phase-heartbeat-late")}
          value={counts.heartbeat_late}
          alertWhenNonZero
        />
        <StatTile
          label={t("credit-registration-admin-phase-failing")}
          value={counts.failing}
          alertWhenNonZero
        />
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
          <PhaseTable
            phases={phases}
            lateMultiplier={list.heartbeat_interval_multiplier}
            caption={processName}
          />
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
    <>
      <QueryResult query={phasesQuery} refreshIndicator={QUIET_REFRESH}>
        {(list) => <PhaseSection list={list} />}
      </QueryResult>
      <EndpointSummarySection />
      <ApiLogSection />
    </>
  )
}

export default SystemPage
