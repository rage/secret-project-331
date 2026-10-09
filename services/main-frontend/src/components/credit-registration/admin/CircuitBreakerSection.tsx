"use client"

import { cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import ScheduledTime from "@/components/credit-registration/ScheduledTime"
import { ZonedTimestamp } from "@/components/credit-registration/ZonedTimestamp"
import { Badge, QueryResult, Table } from "@/shared-module/components"

import {
  ALIGN_END,
  CREDIT_REGISTRATION_NS,
  DENSITY_COMPACT,
  QUIET_REFRESH,
  TABLE_STACK,
  TONE,
} from "../constants"
import {
  headingCss,
  noteCss,
  proseCss,
  sectionCardCss,
  sectionCardHeaderCss,
  stackedCellCss,
} from "../styles"
import { suotarEndpointLabel } from "./adminCreditRegistrationCopy"
import { useCreditRegistrationPhases } from "./adminCreditRegistrationHooks"
import { breakerNextAttemptAt, breakerStatusLabel, breakerTargetLabel } from "./breakerStatus"

/** How each worker process's own circuit breakers last reported themselves. */
const CircuitBreakerSection: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const phasesQuery = useCreditRegistrationPhases()

  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-circuit-breakers")}</h2>
      </div>
      <p className={cx(noteCss, proseCss)}>
        {t("credit-registration-admin-circuit-breakers-note")}
      </p>
      <QueryResult query={phasesQuery} refreshIndicator={QUIET_REFRESH}>
        {(list) => (
          <Table
            caption={t("credit-registration-heading-circuit-breakers")}
            density={DENSITY_COMPACT}
            responsive={TABLE_STACK}
            rowKey={(row) => `${row.process_name}/${row.target}`}
            rows={list.circuit_breakers}
            emptyState={t("credit-registration-admin-no-circuit-breakers")}
            columns={[
              {
                header: t("credit-registration-admin-column-process"),
                minWidth: "10rem",
                cell: (row) => row.process_name,
              },
              {
                header: t("credit-registration-admin-column-target"),
                minWidth: "9rem",
                cell: (row) => breakerTargetLabel(t, row.target),
              },
              {
                header: t("label-status"),
                minWidth: "11rem",
                cell: (row) => {
                  const { status } = row
                  return (
                    <span className={stackedCellCss}>
                      {status === "closed" ? (
                        <span>{breakerStatusLabel(t, status)}</span>
                      ) : (
                        <Badge tone={status === "open" ? TONE.DANGER : TONE.WARNING} size="compact">
                          {breakerStatusLabel(t, status)}
                        </Badge>
                      )}
                      {status === "open" &&
                        row.open_for_secs !== null &&
                        row.open_for_secs !== undefined && (
                          <span className={noteCss}>
                            {t("credit-registration-admin-breaker-next-attempt-note")}{" "}
                            <ScheduledTime at={breakerNextAttemptAt(row.open_for_secs)} />
                          </span>
                        )}
                    </span>
                  )
                },
              },
              {
                header: t("credit-registration-admin-column-failures"),
                align: ALIGN_END,
                minWidth: "7rem",
                nowrap: true,
                cell: (row) => row.consecutive_failures,
              },
              {
                header: t("credit-registration-admin-column-trip-count"),
                align: ALIGN_END,
                minWidth: "5rem",
                nowrap: true,
                cell: (row) => row.trip_count,
              },
              {
                header: t("credit-registration-admin-column-pauses"),
                grow: true,
                minWidth: "12rem",
                cell: (row) => (
                  <span className={stackedCellCss}>
                    {row.endpoints.map((endpoint) => (
                      <span key={endpoint}>{suotarEndpointLabel(t, endpoint)}</span>
                    ))}
                  </span>
                ),
              },
              {
                header: t("credit-registration-admin-column-recorded-at"),
                minWidth: "8rem",
                nowrap: true,
                cell: (row) => <ZonedTimestamp at={row.updated_at} />,
              },
            ]}
          />
        )}
      </QueryResult>
    </section>
  )
}

export default CircuitBreakerSection
