"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import { formatInTimeZone } from "date-fns-tz"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { isSuccessState } from "@/components/credit-registration/admin/adminCreditRegistrationCopy"
import {
  useCreditRegistrationOverview,
  useSuotarHealth,
} from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminStateBadge from "@/components/credit-registration/admin/AdminStateBadge"
import { ReasonConfirmDialog } from "@/components/credit-registration/admin/ReasonConfirmDialog"
import RelativeTime, { ABSENT } from "@/components/credit-registration/admin/RelativeTime"
import Sparkline from "@/components/credit-registration/admin/Sparkline"
import { TONE } from "@/components/credit-registration/constants"
import {
  headingCss,
  noteCss,
  sectionCss,
  sectionsCss,
  tilesCss,
} from "@/components/credit-registration/styles"
import { getCreditRegistrationOverviewQueryKey } from "@/generated/api/@tanstack/react-query.generated"
import { adminPausePhase, adminResumePhase, adminRunPhaseNow } from "@/generated/api/sdk.generated"
import type {
  CreditRegistrationOverview,
  CreditRegistrationPhaseStatus,
  SuotarHealth,
} from "@/generated/api/types.generated"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { creditRegistrationRegistrationsRoute } from "@/shared-module/common/utils/routes"
import {
  Badge,
  Button,
  Disclosure,
  Link,
  QueryResult,
  StatTile,
  Table,
} from "@/shared-module/components"

// oxlint-disable-next-line i18next/no-literal-string
const ATTENTION_QUERY = "?needs_admin_attention=true"
// oxlint-disable-next-line i18next/no-literal-string
const STATE_QUERY = "?state="
// oxlint-disable-next-line i18next/no-literal-string
const ERROR_CODE_QUERY = "?error_code="
const THROUGHPUT_TABLE_DAYS = 14
const HOURLY_WINDOW_SECS = 3600
const SECONDS_PER_DAY = 86_400
// oxlint-disable-next-line i18next/no-literal-string
const UTC = "UTC"
// oxlint-disable-next-line i18next/no-literal-string
const DAY_FORMAT = "yyyy-MM-dd"

const chipsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
`

const phaseActionsCss = css`
  display: flex;
  gap: 0.4rem;
`

const chipCss = css`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  text-decoration: none;
  color: inherit;
`

const secondsSince = (from: string): number => (Date.now() - new Date(from).getTime()) / 1000

const StateSection: React.FC<{ overview: CreditRegistrationOverview }> = ({ overview }) => {
  const { t } = useTranslation()
  const rows = overview.counts_by_state.toSorted((a, b) => b.count - a.count)
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  const success = rows
    .filter((row) => isSuccessState(row.state))
    .reduce((sum, row) => sum + row.count, 0)
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-states")}</h2>
      {rows.length === 0 ? (
        <p className={noteCss}>{t("credit-registration-admin-no-registrations")}</p>
      ) : (
        <>
          <div className={chipsCss}>
            {rows.map((row) => (
              <Link
                key={row.state}
                className={chipCss}
                href={`${creditRegistrationRegistrationsRoute()}${STATE_QUERY}${row.state}`}
              >
                <AdminStateBadge state={row.state} />
                <span>{row.count}</span>
              </Link>
            ))}
          </div>
          <p className={noteCss}>
            {t("credit-registration-admin-live-rows-total", { total, success })}
          </p>
        </>
      )}
    </section>
  )
}

const AttentionSection: React.FC<{ overview: CreditRegistrationOverview }> = ({ overview }) => {
  const { t } = useTranslation()
  const stuckTotal = overview.stuck.reduce((sum, row) => sum + row.count, 0)
  const oldest = overview.oldest_non_terminal
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-attention")}</h2>
      <div className={tilesCss}>
        <StatTile
          label={t("label-credit-registration-needs-attention")}
          value={overview.needs_admin_attention_count}
          href={`${creditRegistrationRegistrationsRoute()}${ATTENTION_QUERY}`}
          {...includeIf(overview.needs_admin_attention_count > 0, { tone: TONE.ALERT })}
        />
        <StatTile
          label={t("label-credit-registration-stuck")}
          value={stuckTotal}
          {...includeIf(stuckTotal > 0, { tone: TONE.ALERT })}
        />
        <StatTile
          label={t("label-credit-registration-oldest-waiting")}
          value={
            oldest
              ? t("credit-registration-admin-days", {
                  count: Math.max(
                    0,
                    Math.trunc(secondsSince(oldest.state_entered_at) / SECONDS_PER_DAY),
                  ),
                })
              : ABSENT
          }
        />
      </div>
      {oldest && (
        <p className={noteCss}>
          {t("credit-registration-admin-oldest-in-state")} <AdminStateBadge state={oldest.state} />{" "}
          <RelativeTime at={oldest.state_entered_at} />
        </p>
      )}
      {overview.stuck.length > 0 && (
        <Table
          caption={t("credit-registration-heading-stuck-by-state")}
          showCaption
          rowKey={(row) => row.state}
          rows={overview.stuck}
          columns={[
            { header: t("label-state"), cell: (row) => <AdminStateBadge state={row.state} /> },
            { header: t("label-count"), cell: (row) => row.count },
            {
              header: t("label-credit-registration-severely-stuck"),
              cell: (row) => row.severely_stuck_count,
            },
            {
              header: t("label-credit-registration-oldest"),
              cell: (row) => <RelativeTime at={row.oldest_state_entered_at} />,
            },
          ]}
        />
      )}
    </section>
  )
}

const ThroughputSection: React.FC<{ overview: CreditRegistrationOverview }> = ({ overview }) => {
  const { t } = useTranslation()
  const registeredPerDay = overview.throughput.map((bucket) => bucket.registered_count)
  const totals = overview.throughput.reduce(
    (sum, bucket) => ({
      registered: sum.registered + bucket.registered_count,
      other: sum.other + bucket.other_success_count,
      failed: sum.failed + bucket.failed_count,
    }),
    { registered: 0, other: 0, failed: 0 },
  )
  const recent = overview.throughput.slice(-THROUGHPUT_TABLE_DAYS).toReversed()
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>
        {t("credit-registration-heading-throughput", { days: overview.throughput_days })}
      </h2>
      <div className={tilesCss}>
        <StatTile label={t("label-credit-registration-registered")} value={totals.registered} />
        <StatTile label={t("label-credit-registration-other-success")} value={totals.other} />
        <StatTile
          label={t("label-credit-registration-failed")}
          value={totals.failed}
          {...includeIf(totals.failed > 0, { tone: TONE.ALERT })}
        />
      </div>
      <Sparkline
        points={registeredPerDay}
        ariaLabel={t("credit-registration-admin-registered-per-day")}
      />
      {overview.throughput.length === 0 ? (
        <p className={noteCss}>{t("credit-registration-admin-no-terminal-outcomes")}</p>
      ) : (
        <Disclosure title={t("credit-registration-admin-show-daily-numbers")}>
          <Table
            caption={t("credit-registration-heading-throughput-table")}
            rowKey={(row) => row.day}
            rows={recent}
            columns={[
              {
                header: t("label-day"),
                // `row.day` is a UTC bucket; the browser's zone would shift the date.
                cell: (row) => formatInTimeZone(row.day, UTC, DAY_FORMAT),
              },
              {
                header: t("label-credit-registration-registered"),
                cell: (row) => row.registered_count,
              },
              {
                header: t("label-credit-registration-other-success"),
                cell: (row) => row.other_success_count,
              },
              { header: t("label-credit-registration-failed"), cell: (row) => row.failed_count },
            ]}
          />
        </Disclosure>
      )}
      <p className={noteCss}>{t("credit-registration-admin-withdrawn-not-counted")}</p>
    </section>
  )
}

const ErrorCodeSection: React.FC<{ overview: CreditRegistrationOverview }> = ({ overview }) => {
  const { t } = useTranslation()
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-error-codes")}</h2>
      {overview.error_codes.length === 0 ? (
        <p className={noteCss}>{t("credit-registration-admin-no-error-codes")}</p>
      ) : (
        <Table
          caption={t("credit-registration-heading-error-codes")}
          rowKey={(row) => row.error_code}
          rows={overview.error_codes}
          columns={[
            {
              header: t("label-error-code"),
              cell: (row) => (
                <Link
                  href={`${creditRegistrationRegistrationsRoute()}${ERROR_CODE_QUERY}${row.error_code}`}
                >
                  <code>{row.error_code}</code>
                </Link>
              ),
            },
            {
              header: t("label-credit-registration-in-flight"),
              cell: (row) => row.in_flight_count,
            },
            {
              header: t("label-credit-registration-terminal-failures"),
              cell: (row) => row.terminal_failure_count,
            },
          ]}
        />
      )}
    </section>
  )
}

const StudyRegistrySection: React.FC<{
  overview: CreditRegistrationOverview
  health: SuotarHealth | undefined
}> = ({ overview, health }) => {
  const { t } = useTranslation()
  const breaker = overview.circuit_breaker
  const hourly = health?.windows.find((window) => window.window_secs === HOURLY_WINDOW_SECS)
  const hourlyByEndpoint = new Map(hourly?.endpoints.map((stats) => [stats.endpoint, stats]))
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-study-registry")}</h2>
      <div className={chipsCss}>
        {/* Closed is neutral, not a success: this breaker says nothing about the workers' calls. */}
        <Badge tone={breaker.open ? TONE.WARNING : TONE.NEUTRAL}>
          {breaker.open
            ? t("credit-registration-admin-breaker-open", { seconds: breaker.open_for_secs ?? 0 })
            : t("credit-registration-admin-breaker-closed")}
        </Badge>
        <Badge tone={TONE.NEUTRAL}>
          {t("credit-registration-admin-breaker-failures", {
            failures: breaker.consecutive_failures,
            limit: breaker.trips_after_consecutive_failures,
          })}
        </Badge>
      </div>
      <p className={noteCss}>{t("credit-registration-admin-breaker-scope-note")}</p>
      {overview.endpoints.length === 0 ? (
        <p className={noteCss}>{t("credit-registration-admin-no-calls-yet")}</p>
      ) : (
        <Table
          caption={t("credit-registration-heading-endpoints")}
          rowKey={(row) => row.endpoint}
          rows={overview.endpoints}
          columns={[
            { header: t("label-endpoint"), cell: (row) => <code>{row.endpoint}</code> },
            {
              header: t("label-credit-registration-last-success"),
              cell: (row) => <RelativeTime at={row.last_success_at} />,
            },
            {
              header: t("label-credit-registration-last-failure"),
              cell: (row) => <RelativeTime at={row.last_failure_at} />,
            },
            {
              header: t("label-credit-registration-consecutive-failures"),
              cell: (row) => row.consecutive_failures,
            },
            {
              header: t("label-credit-registration-calls-last-hour"),
              cell: (row) => hourlyByEndpoint.get(row.endpoint)?.call_count ?? 0,
            },
            {
              header: t("label-credit-registration-p95-ms"),
              cell: (row) => hourlyByEndpoint.get(row.endpoint)?.p95_duration_ms ?? ABSENT,
            },
          ]}
        />
      )}
    </section>
  )
}

const PhaseHeartbeat: React.FC<{ phase: CreditRegistrationPhaseStatus }> = ({ phase }) => {
  const { t } = useTranslation()
  if (phase.paused_at) {
    return <Badge tone={TONE.WARNING}>{t("credit-registration-admin-phase-paused")}</Badge>
  }
  if (!phase.implemented) {
    return <Badge tone={TONE.NEUTRAL}>{t("credit-registration-admin-phase-not-built")}</Badge>
  }
  if (!phase.last_heartbeat_at) {
    return <Badge tone={TONE.NEUTRAL}>{t("credit-registration-admin-phase-never-reported")}</Badge>
  }
  return (
    <Badge tone={phase.heartbeat_late ? TONE.WARNING : TONE.SUCCESS}>
      <RelativeTime at={phase.last_heartbeat_at} />
    </Badge>
  )
}

const PhaseActions: React.FC<{ phase: CreditRegistrationPhaseStatus }> = ({ phase }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { confirm } = useDialog()
  const [pauseOpen, setPauseOpen] = useState(false)

  const invalidateOverview = () =>
    queryClient.invalidateQueries({ queryKey: getCreditRegistrationOverviewQueryKey() })

  const pauseMutation = useToastMutation(
    (fields: { reason: string }) =>
      adminPausePhase({ path: { phase: phase.phase }, body: { reason: fields.reason } }),
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        setPauseOpen(false)
        void invalidateOverview()
      },
    },
  )
  const resumeMutation = useToastMutation(
    () => adminResumePhase({ path: { phase: phase.phase }, body: { reason: null } }),
    { notify: true, method: "POST" },
    { onSuccess: () => void invalidateOverview() },
  )
  const runNowMutation = useToastMutation(
    () => adminRunPhaseNow({ path: { phase: phase.phase }, body: { reason: null } }),
    { notify: true, method: "POST" },
    { onSuccess: () => void invalidateOverview() },
  )

  if (!phase.implemented) {
    return null
  }

  return (
    <div className={phaseActionsCss}>
      {phase.paused_at ? (
        <Button
          variant="tertiary"
          size="small"
          isLoading={resumeMutation.isPending}
          onClick={async () => {
            const confirmed = await confirm(
              t("credit-registration-admin-phase-resume-confirm", { phase: phase.phase }),
            )
            if (confirmed) {
              resumeMutation.mutate()
            }
          }}
        >
          {t("button-text-credit-registration-phase-resume")}
        </Button>
      ) : (
        <>
          <Button variant="tertiary" size="small" onClick={() => setPauseOpen(true)}>
            {t("button-text-credit-registration-phase-pause")}
          </Button>
          <Button
            variant="tertiary"
            size="small"
            isLoading={runNowMutation.isPending}
            onClick={async () => {
              const confirmed = await confirm(
                t("credit-registration-admin-phase-run-now-confirm", { phase: phase.phase }),
              )
              if (confirmed) {
                runNowMutation.mutate()
              }
            }}
          >
            {t("button-text-credit-registration-phase-run-now")}
          </Button>
        </>
      )}
      <ReasonConfirmDialog
        open={pauseOpen}
        onClose={() => setPauseOpen(false)}
        title={t("credit-registration-admin-phase-pause-title", { phase: phase.phase })}
        reasonDescription={t("credit-registration-admin-phase-pause-reason-description")}
        isPending={pauseMutation.isPending}
        onConfirm={(reason) => pauseMutation.mutate({ reason })}
      />
    </div>
  )
}

const PhaseSection: React.FC<{ phases: CreditRegistrationPhaseStatus[] }> = ({ phases }) => {
  const { t } = useTranslation()
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-phases")}</h2>
      <p className={noteCss}>{t("credit-registration-admin-phase-heartbeat-note")}</p>
      <Table
        caption={t("credit-registration-heading-phases")}
        rowKey={(row) => row.phase}
        rows={phases}
        columns={[
          { header: t("label-phase"), cell: (row) => <code>{row.phase}</code> },
          { header: t("label-process"), cell: (row) => <code>{row.process_name}</code> },
          {
            header: t("label-credit-registration-heartbeat"),
            cell: (row) => <PhaseHeartbeat phase={row} />,
          },
          {
            header: t("label-credit-registration-last-success"),
            cell: (row) => <RelativeTime at={row.last_success_at} />,
          },
          {
            header: t("label-credit-registration-last-run"),
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
            header: t("label-actions"),
            cell: (row) => <PhaseActions phase={row} />,
          },
        ]}
      />
    </section>
  )
}

const OverviewPage: React.FC = () => {
  const overviewQuery = useCreditRegistrationOverview()
  const suotarHealthQuery = useSuotarHealth()

  return (
    <QueryResult query={overviewQuery}>
      {(overview) => (
        <div className={sectionsCss}>
          <StateSection overview={overview} />
          <AttentionSection overview={overview} />
          <ThroughputSection overview={overview} />
          <ErrorCodeSection overview={overview} />
          <StudyRegistrySection overview={overview} health={suotarHealthQuery.data} />
          <PhaseSection phases={overview.phases} />
        </div>
      )}
    </QueryResult>
  )
}

export default OverviewPage
