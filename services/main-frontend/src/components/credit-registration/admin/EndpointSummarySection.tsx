"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { QueryResult, RelativeTime, Table } from "@/shared-module/components"

import { ABSENT, ALIGN_END, DENSITY_COMPACT, QUIET_REFRESH, TIME_COMPACT } from "../constants"
import { controlCss, controlsCss, headingCss, noteCss, sectionCss, stackedCellCss } from "../styles"
import { useSuotarHealth } from "./adminCreditRegistrationHooks"
import { DAY_SECS, useWindowSecsParam, WindowSecsSelect } from "./WindowSecsSelect"

/** One row per study registry endpoint over the chosen window: how much we called it, and how it went. */
const EndpointSummarySection: React.FC = () => {
  const { t } = useTranslation()
  const healthQuery = useSuotarHealth()
  const { control, windowSecs } = useWindowSecsParam(DAY_SECS)

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-endpoints")}</h2>
      <div className={controlsCss}>
        <div className={controlCss}>
          <WindowSecsSelect control={control} />
        </div>
      </div>
      <QueryResult query={healthQuery} refreshIndicator={QUIET_REFRESH}>
        {(health) => (
          <Table
            caption={t("credit-registration-heading-endpoints")}
            density={DENSITY_COMPACT}
            rowKey={(row) => row.endpoint}
            rows={
              health.windows.find((window) => window.window_secs === windowSecs)?.endpoints ?? []
            }
            emptyState={t("credit-registration-admin-no-calls-in-window")}
            columns={[
              {
                header: t("label-endpoint"),
                grow: true,
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
                minWidth: "7rem",
                cell: (row) => row.failed_call_count,
              },
              {
                header: t("credit-registration-admin-column-error-items"),
                align: ALIGN_END,
                minWidth: "6rem",
                cell: (row) => row.error_item_count,
              },
              {
                header: t("label-credit-registration-p95-ms"),
                align: ALIGN_END,
                minWidth: "5rem",
                nowrap: true,
                cell: (row) => row.p95_duration_ms ?? ABSENT,
              },
              {
                header: t("label-credit-registration-last-failure"),
                minWidth: "9rem",
                cell: (row) => (
                  <span className={stackedCellCss}>
                    <RelativeTime at={row.last_failure_at} absoluteTime={TIME_COMPACT} />
                    {row.last_request_level_error_code && (
                      <span className={noteCss}>
                        <code>{row.last_request_level_error_code}</code>
                      </span>
                    )}
                  </span>
                ),
              },
            ]}
          />
        )}
      </QueryResult>
    </section>
  )
}

export default EndpointSummarySection
