"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { getEmailTrackingStats } from "@/generated/api/sdk.generated"
import type { EmailEngagementStats } from "@/generated/api/types.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { baseTheme } from "@/shared-module/common/styles"
import { formatNumber } from "@/shared-module/common/utils/numbers"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function pct(num: number, denom: number): string {
  if (denom === 0) {
    // eslint-disable-next-line i18next/no-literal-string
    return "—"
  }
  return `${((num / denom) * 100).toFixed(1)}%`
}

function EmailStatsDashboard() {
  const { t } = useTranslation()

  const statsQuery = useQuery({
    queryKey: ["email-tracking-stats"],
    queryFn: () => getEmailTrackingStats(),
  })

  return (
    <div>
      <h1
        className={css`
          margin-bottom: 2rem;
        `}
      >
        {t("email-stats-dashboard-heading")}
      </h1>

      {statsQuery.isError && <ErrorBanner variant={"readOnly"} error={statsQuery.error} />}
      {statsQuery.isLoading && <Spinner variant={"medium"} />}
      {statsQuery.isSuccess && statsQuery.data && (
        <div
          className={css`
            overflow-x: auto;
          `}
        >
          <table
            className={css`
              width: 100%;
              border-collapse: collapse;
              font-size: 0.875rem;

              th,
              td {
                padding: 0.75rem 1rem;
                text-align: left;
                border-bottom: 1px solid ${baseTheme.colors.gray[100]};
              }

              th {
                font-weight: 600;
                color: ${baseTheme.colors.gray[600]};
                background: ${baseTheme.colors.gray[50]};
                white-space: nowrap;
              }

              tr:last-child td {
                border-bottom: none;
              }

              tr:hover td {
                background: ${baseTheme.colors.gray[50]};
              }
            `}
          >
            <thead>
              <tr>
                <th>{t("email-stats-template-type")}</th>
                <th>{t("email-stats-sent")}</th>
                <th>{t("email-stats-opened")}</th>
                <th>{t("email-stats-open-rate")}</th>
                <th>{t("email-stats-clicked")}</th>
                <th>{t("email-stats-click-rate")}</th>
                <th>{t("email-stats-hard-bounces")}</th>
                <th>{t("email-stats-soft-bounces")}</th>
              </tr>
            </thead>
            <tbody>
              {statsQuery.data.map((row: EmailEngagementStats) => (
                <tr key={row.template_type ?? "unknown"}>
                  {/* eslint-disable-next-line i18next/no-literal-string */}
                  <td>{row.template_type ?? "—"}</td>
                  <td>{formatNumber(row.total_sent)}</td>
                  <td>{formatNumber(row.unique_opened)}</td>
                  <td>{pct(row.unique_opened, row.total_sent)}</td>
                  <td>{formatNumber(row.unique_clicked)}</td>
                  <td>{pct(row.unique_clicked, row.total_sent)}</td>
                  <td>{formatNumber(row.hard_bounces)}</td>
                  <td>{formatNumber(row.soft_bounces)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default withErrorBoundary(withSignedIn(EmailStatsDashboard))
