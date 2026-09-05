"use client"

import { css } from "@emotion/css"
import type { EChartsOption } from "echarts"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import Echarts from "@/components/charts/Echarts"
import { stateName } from "@/components/credit-registration/admin/adminCreditRegistrationCopy"
import {
  useCreditRegistrationOverview,
  useCreditRegistrationPipelineHistory,
} from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminStateBadge from "@/components/credit-registration/admin/AdminStateBadge"
import {
  ALIGN_END,
  MIDDLE_DOT,
  QUIET_REFRESH,
  TONE,
} from "@/components/credit-registration/constants"
import {
  controlCss,
  controlsCss,
  emptyStateCss,
  headingCss,
  noteCss,
  sectionCss,
  sectionsCss,
  subheadingCss,
  subsectionCss,
} from "@/components/credit-registration/styles"
import type {
  CreditRegistrationHistory,
  CreditRegistrationOverview,
  CreditRegistrationState,
} from "@/generated/api/types.generated"
import { includeIf } from "@/shared-module/common/utils/nullability"
import {
  creditRegistrationErrorsRoute,
  creditRegistrationRegistrationsRoute,
} from "@/shared-module/common/utils/routes"
import {
  Link,
  QueryResult,
  Select,
  StatTile,
  StatTileList,
  Table,
} from "@/shared-module/components"

const CHART_HEIGHT = 260
const RECENT_DAYS = 7
const MS_PER_DAY = 86_400_000
const DAY_LENGTH = 10

// oxlint-disable-next-line i18next/no-literal-string
const ATTENTION_QUERY = "?needs_admin_attention=true"
// oxlint-disable-next-line i18next/no-literal-string
const STUCK_QUERY = "?reason=stuck_in_state"
// oxlint-disable-next-line i18next/no-literal-string
const STATE_QUERY = "state"
// oxlint-disable-next-line i18next/no-literal-string
const MONTH_DAYS = "30"
// oxlint-disable-next-line i18next/no-literal-string
const QUARTER_DAYS = "90"
// oxlint-disable-next-line i18next/no-literal-string
const YEAR_DAYS = "365"

type QueueBucket = "waiting" | "in_progress" | "needs_human" | "done"

/**
 * Which of the four buckets each ledger state belongs to. `satisfies` over the whole enum means a
 * state added to the backend fails the build here rather than silently vanishing from the totals.
 */
const BUCKET_OF_STATE = {
  pending: "waiting",
  blocked: "waiting",
  ready_to_submit: "in_progress",
  resolving_enrolment: "in_progress",
  checking_enrolment: "in_progress",
  submitting: "in_progress",
  awaiting_verification: "in_progress",
  no_usable_enrolment: "needs_human",
  submission_uncertain: "needs_human",
  failed_retryable: "needs_human",
  failed_permanent: "needs_human",
  misregistered: "needs_human",
  registered: "done",
  duplicate: "done",
  not_improved: "done",
  cancelled: "done",
} as const satisfies Record<CreditRegistrationState, QueueBucket>

const BUCKET_ORDER: QueueBucket[] = ["waiting", "in_progress", "needs_human", "done"]

const BUCKET_KEYS = {
  waiting: "credit-registration-admin-bucket-waiting",
  in_progress: "credit-registration-admin-bucket-in-progress",
  needs_human: "credit-registration-admin-bucket-needs-human",
  done: "credit-registration-admin-bucket-done",
} as const satisfies Record<QueueBucket, string>

/** Terminal states only ever grow, so charting them beside the queues would flatten every queue. */
const CHARTED_BUCKETS: ReadonlySet<QueueBucket> = new Set(["waiting", "in_progress", "needs_human"])

const chartCss = css`
  max-width: 60rem;
`

const statesQuery = (states: CreditRegistrationState[]): string =>
  `?${states.map((state) => `${STATE_QUERY}=${state}`).join("&")}`

const AttentionSection: React.FC<{ overview: CreditRegistrationOverview }> = ({ overview }) => {
  const { t } = useTranslation()
  const stuckTotal = overview.stuck.reduce((sum, row) => sum + row.count, 0)
  const recent = overview.throughput.slice(-RECENT_DAYS)
  const registered = recent.reduce(
    (sum, bucket) => sum + bucket.registered_count + bucket.other_success_count,
    0,
  )
  const failed = recent.reduce((sum, bucket) => sum + bucket.failed_count, 0)

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-needs-attention")}</h2>
      <StatTileList ariaLabel={t("credit-registration-heading-needs-attention")}>
        <StatTile
          label={t("label-credit-registration-needs-attention")}
          value={overview.needs_admin_attention_count}
          href={`${creditRegistrationRegistrationsRoute()}${ATTENTION_QUERY}`}
          {...includeIf(overview.needs_admin_attention_count > 0, { tone: TONE.ALERT })}
        />
        <StatTile
          label={t("label-credit-registration-stuck")}
          value={stuckTotal}
          href={`${creditRegistrationErrorsRoute()}${STUCK_QUERY}`}
          {...includeIf(stuckTotal > 0, { tone: TONE.ALERT })}
        />
        <StatTile
          label={t("credit-registration-admin-registered-in-days", { days: RECENT_DAYS })}
          value={registered}
        />
        <StatTile
          label={t("credit-registration-admin-failed-in-days", { days: RECENT_DAYS })}
          value={failed}
          {...includeIf(failed > 0, { tone: TONE.ALERT })}
        />
      </StatTileList>
    </section>
  )
}

interface BucketRow {
  bucket: QueueBucket
  count: number
  states: CreditRegistrationState[]
}

const QueueSection: React.FC<{ overview: CreditRegistrationOverview }> = ({ overview }) => {
  const { t } = useTranslation()
  const rows: BucketRow[] = BUCKET_ORDER.map((bucket) => {
    const inBucket = overview.counts_by_state.filter(
      (row) => BUCKET_OF_STATE[row.state] === bucket && row.count > 0,
    )
    return {
      bucket,
      count: inBucket.reduce((sum, row) => sum + row.count, 0),
      states: inBucket.toSorted((a, b) => b.count - a.count).map((row) => row.state),
    }
  }).filter((row) => row.count > 0)

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-states")}</h2>
      {rows.length === 0 ? (
        <p className={emptyStateCss}>{t("credit-registration-admin-no-registrations")}</p>
      ) : (
        <Table
          caption={t("credit-registration-heading-states")}
          rowKey={(row) => row.bucket}
          rows={rows}
          columns={[
            {
              header: t("credit-registration-admin-column-stage"),
              cell: (row) => t(BUCKET_KEYS[row.bucket]),
            },
            {
              header: t("label-count"),
              align: ALIGN_END,
              cell: (row) => (
                <Link href={`${creditRegistrationRegistrationsRoute()}${statesQuery(row.states)}`}>
                  {row.count}
                </Link>
              ),
            },
            {
              header: t("label-state"),
              cell: (row) => <code>{row.states.join(MIDDLE_DOT)}</code>,
            },
          ]}
        />
      )}
    </section>
  )
}

const CHARTED_STATES = (Object.keys(BUCKET_OF_STATE) as CreditRegistrationState[]).filter((state) =>
  CHARTED_BUCKETS.has(BUCKET_OF_STATE[state]),
)

/** Every day in the range, so a day the snapshot phase missed stays a gap on the axis. */
const dateRange = (from: string, to: string): string[] => {
  const days: string[] = []
  for (let day = new Date(from).getTime(); day <= new Date(to).getTime(); day += MS_PER_DAY) {
    // `toISOString` is safe here: the endpoint's dates are plain UTC days with no offset to lose.
    days.push(new Date(day).toISOString().slice(0, DAY_LENGTH))
  }
  return days
}

const DepthChart: React.FC<{ history: CreditRegistrationHistory }> = ({ history }) => {
  const { t } = useTranslation()
  const days = dateRange(history.from, history.to)
  const byDate = new Map(history.days.map((day) => [day.snapshot_date, day]))
  const series = CHARTED_STATES.map((state) => ({
    state,
    // A day with no snapshot is a hole, not a zero: the line must break rather than dive.
    points: days.map(
      (day) => byDate.get(day)?.states.find((point) => point.state === state)?.count ?? null,
    ),
  })).filter((candidate) => candidate.points.some((point) => point !== null && point > 0))

  if (series.length === 0) {
    return <p className={emptyStateCss}>{t("credit-registration-admin-no-snapshots")}</p>
  }

  const options: EChartsOption = {
    // oxlint-disable-next-line i18next/no-literal-string
    tooltip: { trigger: "axis" },
    legend: { data: series.map((candidate) => stateName(candidate.state)) },
    // oxlint-disable-next-line i18next/no-literal-string
    grid: { left: 48, right: 16, top: 56, bottom: 32 },
    // oxlint-disable-next-line i18next/no-literal-string
    xAxis: { type: "category", data: days },
    // oxlint-disable-next-line i18next/no-literal-string
    yAxis: { type: "value", name: t("credit-registration-admin-queue-depth-axis"), minInterval: 1 },
    series: series.map((candidate) => ({
      name: stateName(candidate.state),
      // oxlint-disable-next-line i18next/no-literal-string
      type: "line",
      showSymbol: false,
      connectNulls: false,
      data: candidate.points,
    })),
  }
  return (
    <div className={chartCss}>
      <Echarts options={options} height={CHART_HEIGHT} />
    </div>
  )
}

const FlowTable: React.FC<{ history: CreditRegistrationHistory }> = ({ history }) => {
  const { t } = useTranslation()
  const latest = history.days.at(-1)
  if (!latest) {
    return <p className={emptyStateCss}>{t("credit-registration-admin-no-snapshots")}</p>
  }
  const rows = latest.states.filter(
    (point) => point.count > 0 || point.entered_count > 0 || point.left_count > 0,
  )
  if (rows.length === 0) {
    return <p className={emptyStateCss}>{t("credit-registration-admin-nothing-moved")}</p>
  }
  return (
    <>
      <p className={noteCss}>
        {t("credit-registration-admin-flow-as-of", { day: latest.snapshot_date })}
      </p>
      <Table
        caption={t("credit-registration-heading-flow")}
        rowKey={(row) => row.state}
        rows={rows}
        columns={[
          { header: t("label-state"), cell: (row) => <AdminStateBadge state={row.state} /> },
          {
            header: t("credit-registration-admin-column-in-state"),
            align: ALIGN_END,
            cell: (row) => row.count,
          },
          {
            header: t("credit-registration-admin-column-entered"),
            align: ALIGN_END,
            cell: (row) => row.entered_count,
          },
          {
            header: t("credit-registration-admin-column-left"),
            align: ALIGN_END,
            cell: (row) => row.left_count,
          },
          {
            header: t("credit-registration-admin-column-net"),
            align: ALIGN_END,
            cell: (row) => row.entered_count - row.left_count,
          },
        ]}
      />
    </>
  )
}

interface DaysFields {
  days: string
}

const TrendSection: React.FC = () => {
  const { t } = useTranslation()
  const { control, watch } = useForm<DaysFields>({ defaultValues: { days: MONTH_DAYS } })
  const historyQuery = useCreditRegistrationPipelineHistory(Number(watch("days")))

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-queue-depth")}</h2>
      <div className={controlsCss}>
        <div className={controlCss}>
          <Select
            name="days"
            control={control}
            label={t("credit-registration-admin-history-length")}
            options={[
              { value: MONTH_DAYS, label: t("credit-registration-admin-window-month") },
              { value: QUARTER_DAYS, label: t("credit-registration-admin-window-quarter") },
              { value: YEAR_DAYS, label: t("credit-registration-admin-window-year") },
            ]}
          />
        </div>
      </div>
      <QueryResult query={historyQuery} refreshIndicator={QUIET_REFRESH}>
        {(history) => (
          <>
            <DepthChart history={history} />
            <div className={subsectionCss}>
              <h3 className={subheadingCss}>{t("credit-registration-heading-flow")}</h3>
              <FlowTable history={history} />
            </div>
          </>
        )}
      </QueryResult>
    </section>
  )
}

/** Whether anything is wrong, where the queue is, and which way it has been moving. */
const OverviewPage: React.FC = () => {
  const overviewQuery = useCreditRegistrationOverview()

  return (
    <div className={sectionsCss}>
      <QueryResult query={overviewQuery} refreshIndicator={QUIET_REFRESH}>
        {(overview) => (
          <>
            <AttentionSection overview={overview} />
            <QueueSection overview={overview} />
          </>
        )}
      </QueryResult>
      <TrendSection />
    </div>
  )
}

export default OverviewPage
