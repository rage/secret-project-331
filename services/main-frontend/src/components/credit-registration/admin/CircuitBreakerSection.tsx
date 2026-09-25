"use client"

import { cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { Badge, QueryResult, RelativeTime, Table } from "@/shared-module/components"

import {
  ALIGN_END,
  CREDIT_REGISTRATION_NS,
  DENSITY_COMPACT,
  MIDDLE_DOT,
  QUIET_REFRESH,
  TABLE_STACK,
  TIME_COMPACT,
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
import { useCreditRegistrationOverview } from "./adminCreditRegistrationHooks"
import {
  breakerHealth,
  breakerHealthLabel,
  breakerNextAttemptAt,
  breakerTargetLabel,
  isUnhealthyBreaker,
} from "./breakerStatus"

/** How each worker process's own circuit breakers last reported themselves. */
const CircuitBreakerSection: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const overviewQuery = useCreditRegistrationOverview()

  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-circuit-breakers")}</h2>
      </div>
      <p className={cx(noteCss, proseCss)}>
        {t("credit-registration-admin-circuit-breakers-note")}
      </p>
      <QueryResult query={overviewQuery} refreshIndicator={QUIET_REFRESH}>
        {(overview) => (
          <Table
            caption={t("credit-registration-heading-circuit-breakers")}
            density={DENSITY_COMPACT}
            responsive={TABLE_STACK}
            rowKey={(row) => `${row.process_name}/${row.target}`}
            rows={overview.circuit_breakers}
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
                  const health = breakerHealth(row)
                  return (
                    <span className={stackedCellCss}>
                      {isUnhealthyBreaker(health) ? (
                        <Badge tone={health === "open" ? TONE.DANGER : TONE.WARNING} size="compact">
                          {breakerHealthLabel(t, health)}
                        </Badge>
                      ) : (
                        <span>{breakerHealthLabel(t, health)}</span>
                      )}
                      {health === "open" &&
                        row.open_for_secs !== null &&
                        row.open_for_secs !== undefined && (
                          <span className={noteCss}>
                            {t("credit-registration-admin-breaker-next-attempt-note")}{" "}
                            <RelativeTime at={breakerNextAttemptAt(row.open_for_secs)} />
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
                cell: (row) => <code>{row.endpoints.join(MIDDLE_DOT)}</code>,
              },
              {
                header: t("credit-registration-admin-column-recorded-at"),
                minWidth: "8rem",
                nowrap: true,
                cell: (row) => <RelativeTime at={row.updated_at} absoluteTime={TIME_COMPACT} />,
              },
            ]}
          />
        )}
      </QueryResult>
    </section>
  )
}

export default CircuitBreakerSection
