"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type {
  EnrolmentCheckRosterCode,
  SuotarEndpointDailyCost,
  SuotarEndpointRateLimit,
} from "@/generated/api/types.generated"
import { Badge, RelativeTime, Table } from "@/shared-module/components"

import {
  ABSENT,
  ALIGN_END,
  CREDIT_REGISTRATION_NS,
  DENSITY_COMPACT,
  TABLE_STACK,
  TIME_COMPACT,
  TIME_DATE,
  TONE,
} from "../constants"
import {
  headingCss,
  noteCss,
  sectionCardCss,
  sectionCardHeaderCss,
  stackedCellCss,
  subheadingCss,
  subsectionCss,
} from "../styles"
import { listingErrorLabel, rosterTierLabel } from "./adminCreditRegistrationCopy"
import { formatPercent } from "./percent"

/** Suotar calls per endpoint per day: the pacing's own cost. */
const DailyCostsTable: React.FC<{ rows: SuotarEndpointDailyCost[] }> = ({ rows }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)

  return (
    <div className={subsectionCss}>
      <h3 className={subheadingCss}>
        {t("credit-registration-heading-enrolment-check-daily-costs")}
      </h3>
      <Table
        caption={t("credit-registration-heading-enrolment-check-daily-costs")}
        density={DENSITY_COMPACT}
        responsive={TABLE_STACK}
        rowKey={(row) => `${row.endpoint}-${row.day}`}
        rows={rows}
        emptyState={t("credit-registration-admin-no-calls-in-window")}
        columns={[
          {
            header: t("credit-registration-admin-column-day"),
            minWidth: "7rem",
            nowrap: true,
            cell: (row) => <RelativeTime at={row.day} absoluteTime={TIME_DATE} />,
          },
          {
            header: t("label-endpoint"),
            minWidth: "12rem",
            cell: (row) => <code>{row.endpoint}</code>,
          },
          {
            header: t("credit-registration-admin-column-calls"),
            align: ALIGN_END,
            minWidth: "5rem",
            nowrap: true,
            cell: (row) => row.call_count,
          },
          {
            header: t("credit-registration-admin-column-failed-calls"),
            align: ALIGN_END,
            minWidth: "6rem",
            nowrap: true,
            cell: (row) => row.failed_call_count,
          },
          {
            header: t("credit-registration-admin-column-items"),
            align: ALIGN_END,
            minWidth: "5rem",
            nowrap: true,
            cell: (row) => row.item_count,
          },
          {
            header: t("credit-registration-admin-column-max-items-per-call"),
            align: ALIGN_END,
            minWidth: "7rem",
            nowrap: true,
            cell: (row) => row.max_items_per_call,
          },
          {
            header: t("label-credit-registration-p50-ms"),
            align: ALIGN_END,
            minWidth: "5rem",
            nowrap: true,
            cell: (row) => row.p50_duration_ms ?? ABSENT,
          },
          {
            header: t("label-credit-registration-p95-ms"),
            align: ALIGN_END,
            minWidth: "5rem",
            nowrap: true,
            cell: (row) => row.p95_duration_ms ?? ABSENT,
          },
        ]}
      />
    </div>
  )
}

const byFailuresThenCode = (a: EnrolmentCheckRosterCode, b: EnrolmentCheckRosterCode): number =>
  b.consecutive_failures - a.consecutive_failures || a.course_code.localeCompare(b.course_code)

/** Every course code's own listing schedule: when it last ran, and whether it is backing off. */
const RosterCodesTable: React.FC<{ rows: EnrolmentCheckRosterCode[] }> = ({ rows }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const sorted = rows.toSorted(byFailuresThenCode)

  return (
    <div className={subsectionCss}>
      <h3 className={subheadingCss}>
        {t("credit-registration-heading-enrolment-check-roster-codes")}
      </h3>
      <Table
        caption={t("credit-registration-heading-enrolment-check-roster-codes")}
        density={DENSITY_COMPACT}
        responsive={TABLE_STACK}
        rowKey={(row) => row.course_code}
        rows={sorted}
        emptyState={t("credit-registration-admin-no-roster-codes")}
        columns={[
          {
            header: t("credit-registration-admin-column-course-code"),
            minWidth: "10rem",
            cell: (row) => (
              <span className={stackedCellCss}>
                <code>{row.course_code}</code>
                <span className={noteCss}>
                  {t("credit-registration-admin-enrolment-checks-modules-count", {
                    count: row.module_count,
                  })}
                </span>
              </span>
            ),
          },
          {
            header: t("credit-registration-admin-column-tier"),
            minWidth: "6rem",
            cell: (row) => rosterTierLabel(t, row.tier),
          },
          {
            header: t("credit-registration-admin-column-last-fetched"),
            minWidth: "10rem",
            cell: (row) => (
              <span className={stackedCellCss}>
                <RelativeTime at={row.last_fetched_at} absoluteTime={TIME_COMPACT} />
                {row.last_fetch_duration_ms !== null &&
                  row.last_fetch_duration_ms !== undefined && (
                    <span className={noteCss}>
                      {t("credit-registration-admin-enrolment-checks-fetch-note", {
                        duration: row.last_fetch_duration_ms,
                        count: row.last_listed_person_count ?? 0,
                      })}
                    </span>
                  )}
              </span>
            ),
          },
          {
            header: t("credit-registration-admin-column-next-fetch"),
            minWidth: "8rem",
            cell: (row) => <RelativeTime at={row.next_fetch_at} absoluteTime={TIME_COMPACT} />,
          },
          {
            header: t("credit-registration-admin-column-triggered-today"),
            align: ALIGN_END,
            minWidth: "8rem",
            cell: (row) => (
              <span className={stackedCellCss}>
                <span>{row.triggered_fetch_count_today}</span>
                {row.is_fetched_alone && (
                  <span className={noteCss}>
                    {t("credit-registration-admin-enrolment-checks-fetched-alone")}
                  </span>
                )}
              </span>
            ),
          },
          {
            header: t("credit-registration-admin-column-failures"),
            align: ALIGN_END,
            minWidth: "10rem",
            cell: (row) =>
              row.consecutive_failures === 0 ? (
                ABSENT
              ) : (
                <span className={stackedCellCss}>
                  <Badge tone={TONE.DANGER} size="compact">
                    {row.consecutive_failures}
                  </Badge>
                  {row.last_error && (
                    <span className={noteCss}>{listingErrorLabel(t, row.last_error)}</span>
                  )}
                  {row.retry_not_before && (
                    <span className={noteCss}>
                      {t("credit-registration-admin-enrolment-checks-backoff-note")}{" "}
                      <RelativeTime at={row.retry_not_before} absoluteTime={TIME_COMPACT} />
                    </span>
                  )}
                </span>
              ),
          },
        ]}
      />
    </div>
  )
}

/** The limiter and breaker state the live worker last reported, per endpoint. */
const RateLimitsTable: React.FC<{ rows: SuotarEndpointRateLimit[] }> = ({ rows }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)

  return (
    <div className={subsectionCss}>
      <h3 className={subheadingCss}>
        {t("credit-registration-heading-enrolment-check-rate-limits")}
      </h3>
      <Table
        caption={t("credit-registration-heading-enrolment-check-rate-limits")}
        density={DENSITY_COMPACT}
        responsive={TABLE_STACK}
        rowKey={(row) => row.endpoint}
        rows={rows}
        emptyState={t("credit-registration-admin-enrolment-checks-rate-limits-empty")}
        columns={[
          {
            header: t("label-endpoint"),
            minWidth: "12rem",
            cell: (row) => <code>{row.endpoint}</code>,
          },
          {
            header: t("credit-registration-admin-column-rate-share"),
            align: ALIGN_END,
            minWidth: "6rem",
            nowrap: true,
            cell: (row) => formatPercent(row.rate_share * 100),
          },
          {
            header: t("credit-registration-admin-column-full-rate"),
            align: ALIGN_END,
            minWidth: "7rem",
            nowrap: true,
            cell: (row) => row.full_rate_per_minute,
          },
          {
            header: t("credit-registration-admin-column-available"),
            align: ALIGN_END,
            minWidth: "7rem",
            nowrap: true,
            cell: (row) => row.available,
          },
          {
            header: t("credit-registration-admin-column-breaker"),
            minWidth: "8rem",
            cell: (row) =>
              row.is_breaker_open ? (
                <Badge tone={TONE.DANGER} size="compact">
                  {t("credit-registration-admin-breaker-open")}
                </Badge>
              ) : (
                ABSENT
              ),
          },
          {
            header: t("credit-registration-admin-column-trip-count"),
            align: ALIGN_END,
            minWidth: "5rem",
            nowrap: true,
            cell: (row) => row.breaker_trip_count,
          },
          {
            header: t("credit-registration-admin-column-recorded-at"),
            minWidth: "8rem",
            nowrap: true,
            cell: (row) => <RelativeTime at={row.updated_at} absoluteTime={TIME_COMPACT} />,
          },
        ]}
      />
    </div>
  )
}

/** What the pacing costs Suotar: calls by day, each course code's listing schedule, and the limiter. */
const EnrolmentCheckCostSection: React.FC<{
  dailyCosts: SuotarEndpointDailyCost[]
  rosterCodes: EnrolmentCheckRosterCode[]
  rateLimits: SuotarEndpointRateLimit[]
}> = ({ dailyCosts, rosterCodes, rateLimits }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)

  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-enrolment-check-cost")}</h2>
      </div>
      <DailyCostsTable rows={dailyCosts} />
      <RosterCodesTable rows={rosterCodes} />
      <RateLimitsTable rows={rateLimits} />
    </section>
  )
}

export default EnrolmentCheckCostSection
