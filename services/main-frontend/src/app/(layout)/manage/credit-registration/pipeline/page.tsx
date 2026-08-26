"use client"

import { css } from "@emotion/css"
import type { EChartsOption } from "echarts"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import Echarts from "@/components/charts/Echarts"
import { useCreditRegistrationPipelineHistory } from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminStateBadge from "@/components/credit-registration/admin/AdminStateBadge"
import {
  headingCss,
  noteCss,
  sectionCss,
  sectionsCss,
} from "@/components/credit-registration/styles"
import type {
  CreditRegistrationHistory,
  CreditRegistrationState,
} from "@/generated/api/types.generated"
import { Disclosure, QueryResult, Select, Table } from "@/shared-module/components"

const CHART_HEIGHT = 360
const MS_PER_DAY = 86_400_000

// oxlint-disable-next-line i18next/no-literal-string
const MONTH_DAYS = "30"
// oxlint-disable-next-line i18next/no-literal-string
const QUARTER_DAYS = "90"
// oxlint-disable-next-line i18next/no-literal-string
const YEAR_DAYS = "365"

/**
 * States whose depth is a queue rather than an archive. Terminal states only ever grow, so charting
 * them beside these would flatten every queue into the axis. `satisfies` over every state means a
 * new one added to the backend enum fails the build here instead of silently vanishing from the chart.
 */
const IS_QUEUE_STATE = {
  pending_prerequisites: true,
  pending_consent: true,
  pending_student_number: true,
  ready_to_submit: true,
  resolving_enrolment: true,
  checking_enrolment: true,
  no_usable_enrolment: true,
  submitting: true,
  submission_uncertain: true,
  awaiting_verification: true,
  registered: false,
  duplicate: false,
  not_improved: false,
  misregistered: false,
  failed_retryable: true,
  failed_permanent: false,
  blocked: true,
  cancelled: false,
  abandoned_by_consent_withdrawal: false,
} satisfies Record<CreditRegistrationState, boolean>

const QUEUE_STATES = (Object.keys(IS_QUEUE_STATE) as CreditRegistrationState[]).filter(
  (state) => IS_QUEUE_STATE[state],
)

interface DaysFields {
  days: string
}

const controlCss = css`
  max-width: 16rem;
`

const dateRange = (from: string, to: string): string[] => {
  const days: string[] = []
  for (let day = new Date(from).getTime(); day <= new Date(to).getTime(); day += MS_PER_DAY) {
    // `toISOString` is safe here: the endpoint's dates are plain UTC days with no offset to lose.
    days.push(new Date(day).toISOString().slice(0, 10))
  }
  return days
}

const DepthChart: React.FC<{ history: CreditRegistrationHistory }> = ({ history }) => {
  const { t } = useTranslation()
  const days = dateRange(history.from, history.to)
  const byDate = new Map(history.days.map((day) => [day.snapshot_date, day]))
  const series = QUEUE_STATES.map((state) => ({
    state,
    // A day with no snapshot is a hole, not a zero: the chart must break rather than dive.
    points: days.map(
      (day) => byDate.get(day)?.states.find((point) => point.state === state)?.count ?? null,
    ),
  })).filter((candidate) => candidate.points.some((point) => point !== null && point > 0))

  if (series.length === 0) {
    return <p className={noteCss}>{t("credit-registration-admin-no-snapshots")}</p>
  }

  const options: EChartsOption = {
    // oxlint-disable-next-line i18next/no-literal-string
    tooltip: { trigger: "axis" },
    legend: { data: series.map((candidate) => candidate.state) },
    // oxlint-disable-next-line i18next/no-literal-string
    xAxis: { type: "category", data: days },
    // oxlint-disable-next-line i18next/no-literal-string
    yAxis: { type: "value", name: t("credit-registration-admin-queue-depth-axis") },
    series: series.map((candidate) => ({
      name: candidate.state,
      // oxlint-disable-next-line i18next/no-literal-string
      type: "line",
      // oxlint-disable-next-line i18next/no-literal-string
      stack: "depth",
      areaStyle: {},
      connectNulls: false,
      data: candidate.points,
    })),
  }
  return <Echarts options={options} height={CHART_HEIGHT} />
}

const FlowSection: React.FC<{ history: CreditRegistrationHistory }> = ({ history }) => {
  const { t } = useTranslation()
  const latest = history.days.at(-1)
  if (!latest) {
    return <p className={noteCss}>{t("credit-registration-admin-no-snapshots")}</p>
  }
  const rows = latest.states.filter(
    (point) => point.count > 0 || point.entered_count > 0 || point.left_count > 0,
  )
  return (
    <>
      <p className={noteCss}>
        {t("credit-registration-admin-flow-as-of", { day: latest.snapshot_date })}
      </p>
      {rows.length === 0 ? (
        <p className={noteCss}>{t("credit-registration-admin-nothing-moved")}</p>
      ) : (
        <Table
          caption={t("credit-registration-heading-flow")}
          rowKey={(row) => row.state}
          rows={rows}
          columns={[
            { header: t("label-state"), cell: (row) => <AdminStateBadge state={row.state} /> },
            { header: t("credit-registration-admin-column-in-state"), cell: (row) => row.count },
            {
              header: t("credit-registration-admin-column-entered"),
              cell: (row) => row.entered_count,
            },
            { header: t("credit-registration-admin-column-left"), cell: (row) => row.left_count },
            {
              header: t("credit-registration-admin-column-net"),
              cell: (row) => row.entered_count - row.left_count,
            },
          ]}
        />
      )}
    </>
  )
}

const DayTable: React.FC<{ history: CreditRegistrationHistory }> = ({ history }) => {
  const { t } = useTranslation()
  const rows = history.days
    .toReversed()
    .flatMap((day) =>
      day.states
        .filter((point) => point.count > 0 || point.entered_count > 0 || point.left_count > 0)
        .map((point) => ({ ...point, snapshot_date: day.snapshot_date })),
    )
  return (
    <Table
      caption={t("credit-registration-heading-history-table")}
      rowKey={(row) => `${row.snapshot_date}:${row.state}`}
      rows={rows}
      columns={[
        { header: t("label-day"), cell: (row) => row.snapshot_date },
        { header: t("label-state"), cell: (row) => <AdminStateBadge state={row.state} /> },
        { header: t("credit-registration-admin-column-in-state"), cell: (row) => row.count },
        { header: t("credit-registration-admin-column-entered"), cell: (row) => row.entered_count },
        { header: t("credit-registration-admin-column-left"), cell: (row) => row.left_count },
      ]}
    />
  )
}

/** Where the queue is, and where it has been: the Overview says whether, this says where. */
const PipelinePage: React.FC = () => {
  const { t } = useTranslation()
  const { control, watch } = useForm<DaysFields>({ defaultValues: { days: MONTH_DAYS } })
  const historyQuery = useCreditRegistrationPipelineHistory(Number(watch("days")))

  return (
    <div className={sectionsCss}>
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
      <QueryResult query={historyQuery}>
        {(history) => (
          <>
            <section className={sectionCss}>
              <h2 className={headingCss}>{t("credit-registration-heading-queue-depth")}</h2>
              <p className={noteCss}>{t("credit-registration-admin-queue-depth-note")}</p>
              <DepthChart history={history} />
              <Disclosure title={t("credit-registration-admin-show-daily-numbers")}>
                <DayTable history={history} />
              </Disclosure>
            </section>
            <section className={sectionCss}>
              <h2 className={headingCss}>{t("credit-registration-heading-flow")}</h2>
              <FlowSection history={history} />
            </section>
          </>
        )}
      </QueryResult>
    </div>
  )
}

export default PipelinePage
