"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { useCreditRegistrationPhases } from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminPhaseActions from "@/components/credit-registration/admin/AdminPhaseActions"
import AdminStateBadge from "@/components/credit-registration/admin/AdminStateBadge"
import type { PhaseHealth } from "@/components/credit-registration/admin/phaseStatus"
import { phaseHealth } from "@/components/credit-registration/admin/phaseStatus"
import RelativeTime, { ABSENT } from "@/components/credit-registration/admin/RelativeTime"
import { TONE } from "@/components/credit-registration/constants"
import { widenedLookup } from "@/components/credit-registration/labelFrom"
import {
  headingCss,
  noteCss,
  sectionCss,
  sectionsCss,
} from "@/components/credit-registration/styles"
import type { CreditRegistrationPhaseRow } from "@/generated/api/types.generated"
import type { BadgeTone } from "@/shared-module/components"
import { Badge, Link, QueryResult, Table } from "@/shared-module/components"

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

const HEALTH_TONES = {
  paused: TONE.WARNING,
  not_built: TONE.NEUTRAL,
  failing: TONE.WARNING,
  heartbeat_late: TONE.WARNING,
  never_reported: TONE.NEUTRAL,
  running: TONE.SUCCESS,
} as const satisfies Record<PhaseHealth, BadgeTone>

const ownedStatesCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
`

const errorCss = css`
  display: block;
  max-width: 24rem;
  overflow-wrap: anywhere;
`

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

const PhaseHealthBadge: React.FC<{ phase: CreditRegistrationPhaseRow }> = ({ phase }) => {
  const { t } = useTranslation()
  const health = phaseHealth(phase)
  return (
    <Badge tone={widenedLookup(HEALTH_TONES, health) ?? TONE.NEUTRAL}>
      {t(widenedLookup(HEALTH_KEYS, health) ?? HEALTH_KEYS.running)}
    </Badge>
  )
}

const ProcessSection: React.FC<{ processName: string; phases: CreditRegistrationPhaseRow[] }> = ({
  processName,
  phases,
}) => {
  const { t } = useTranslation()
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>
        <code>{processName}</code>
      </h2>
      <Table
        caption={t("credit-registration-admin-phases-of-process", { process: processName })}
        rowKey={(row) => row.phase}
        rows={phases}
        columns={[
          { header: t("label-phase"), cell: (row) => <code>{row.phase}</code> },
          { header: t("label-status"), cell: (row) => <PhaseHealthBadge phase={row} /> },
          {
            header: t("label-credit-registration-heartbeat"),
            cell: (row) => <RelativeTime at={row.last_heartbeat_at} />,
          },
          {
            header: t("label-credit-registration-expected-interval"),
            cell: (row) =>
              t("credit-registration-admin-seconds", { count: row.expected_interval_secs }),
          },
          {
            header: t("label-credit-registration-last-run"),
            cell: (row) => <RelativeTime at={row.last_run_finished_at} />,
          },
          {
            header: t("label-credit-registration-last-run-duration"),
            cell: (row) =>
              row.last_run_duration_secs === null
                ? ABSENT
                : t("credit-registration-admin-seconds", { count: row.last_run_duration_secs }),
          },
          {
            header: t("label-credit-registration-last-success"),
            cell: (row) => <RelativeTime at={row.last_success_at} />,
          },
          {
            header: t("label-credit-registration-next-run"),
            cell: (row) => <RelativeTime at={row.next_run_at} />,
          },
          {
            header: t("label-credit-registration-items-last-run"),
            cell: (row) =>
              row.items_processed_last_run === null
                ? ABSENT
                : t("credit-registration-admin-items-processed-failed", {
                    processed: row.items_processed_last_run,
                    failed: row.items_failed_last_run ?? 0,
                  }),
          },
          {
            header: t("label-credit-registration-consecutive-failures"),
            cell: (row) => row.consecutive_failures,
          },
          {
            header: t("label-credit-registration-queue-depth"),
            // A phase owning no ledger state has no queue, which is not the same as an empty one.
            cell: (row) => row.queue_depth ?? ABSENT,
          },
          {
            header: t("label-credit-registration-owned-states"),
            cell: (row) => (
              <span className={ownedStatesCss}>
                {row.owned_states.map((state) => (
                  <AdminStateBadge key={state} state={state} />
                ))}
              </span>
            ),
          },
          {
            header: t("label-credit-registration-last-error"),
            cell: (row) =>
              row.last_error ? <code className={errorCss}>{row.last_error}</code> : ABSENT,
          },
          {
            header: t("label-reason"),
            cell: (row) => row.pause_reason ?? ABSENT,
          },
          {
            header: t("label-actions"),
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
    </section>
  )
}

const WorkersPage: React.FC = () => {
  const { t } = useTranslation()
  const phasesQuery = useCreditRegistrationPhases()

  return (
    <QueryResult query={phasesQuery}>
      {(list) => (
        <div className={sectionsCss}>
          <section className={sectionCss}>
            <h2 className={headingCss}>{t("credit-registration-heading-phases")}</h2>
            {list.paused_globally && (
              <Badge tone={TONE.WARNING}>{t("credit-registration-admin-paused-globally")}</Badge>
            )}
            <p className={noteCss}>
              {t("credit-registration-admin-phase-late-note", {
                multiplier: list.heartbeat_interval_multiplier,
                limit: list.consecutive_failure_limit,
              })}
            </p>
            <p className={noteCss}>
              {t("credit-registration-admin-pause-is-our-flag-note")}{" "}
              <Link href={POD_STATUS_PATH}>{t("credit-registration-admin-open-pod-status")}</Link>
            </p>
          </section>
          {list.phases.length === 0 ? (
            <p className={noteCss}>{t("credit-registration-admin-no-phases")}</p>
          ) : (
            groupByProcess(list.phases).map(([processName, phases]) => (
              <ProcessSection key={processName} processName={processName} phases={phases} />
            ))
          )}
        </div>
      )}
    </QueryResult>
  )
}

export default WorkersPage
