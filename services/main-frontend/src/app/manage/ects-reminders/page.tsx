"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { getEctsReminderStats, getEctsReminderStatsByCourse } from "@/generated/api/sdk.generated"
import type { EctsReminderCourseStats } from "@/generated/api/types.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { baseTheme } from "@/shared-module/common/styles"
import { formatNumber } from "@/shared-module/common/utils/numbers"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const statBoxStyles = css`
  flex: 1;
  min-width: 160px;
  border: 3px solid ${baseTheme.colors.clear[200]};
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
`

const statValueStyles = css`
  font-size: 2.2rem;
  font-weight: bold;
  color: ${baseTheme.colors.green[600]};
  margin-bottom: 0.5rem;
`

const statLabelStyles = css`
  font-size: 0.8125rem;
  color: ${baseTheme.colors.gray[500]};
`

function StatBox({ value, label }: { value: number | string; label: string }) {
  return (
    <div className={statBoxStyles}>
      <div className={statValueStyles}>
        {typeof value === "number" ? formatNumber(value) : value}
      </div>
      <div className={statLabelStyles}>{label}</div>
    </div>
  )
}

function EctsRemindersDashboard() {
  const { t } = useTranslation()

  const globalStatsQuery = useQuery({
    queryKey: ["ects-reminder-stats-global"],
    queryFn: () => getEctsReminderStats(),
  })

  const perCourseQuery = useQuery({
    queryKey: ["ects-reminder-stats-by-course"],
    queryFn: () => getEctsReminderStatsByCourse(),
  })

  return (
    <div>
      <h1
        className={css`
          margin-bottom: 2rem;
        `}
      >
        {t("ects-reminders-dashboard-heading")}
      </h1>

      {globalStatsQuery.isError && (
        <ErrorBanner variant={"readOnly"} error={globalStatsQuery.error} />
      )}
      {globalStatsQuery.isLoading && <Spinner variant={"medium"} />}
      {globalStatsQuery.isSuccess && globalStatsQuery.data && (
        <>
          <h2>{t("ects-reminders-overview")}</h2>
          <div
            className={css`
              display: flex;
              flex-wrap: wrap;
              gap: 1rem;
              margin-bottom: 2rem;
            `}
          >
            <StatBox
              value={globalStatsQuery.data.eligible_completions}
              label={t("ects-stat-eligible-completions")}
            />
            <StatBox
              value={globalStatsQuery.data.finland_eligible_completions}
              label={t("ects-stat-finland-eligible")}
            />
            <StatBox
              value={globalStatsQuery.data.initial_emails_sent}
              label={t("ects-stat-initial-emails")}
            />
            <StatBox
              value={globalStatsQuery.data.follow_up_emails_sent}
              label={t("ects-stat-follow-up-emails")}
            />
            <StatBox
              value={globalStatsQuery.data.registered_after_email}
              label={t("ects-stat-registered-after-email")}
            />
            <StatBox
              value={
                globalStatsQuery.data.finland_eligible_completions > 0
                  ? `${((globalStatsQuery.data.registered_after_email / globalStatsQuery.data.finland_eligible_completions) * 100).toFixed(1)}%`
                  : "—"
              }
              label={t("ects-stat-conversion-rate")}
            />
            <StatBox value={globalStatsQuery.data.opted_out} label={t("ects-stat-opted-out")} />
          </div>
        </>
      )}

      {perCourseQuery.isError && <ErrorBanner variant={"readOnly"} error={perCourseQuery.error} />}
      {perCourseQuery.isLoading && <Spinner variant={"medium"} />}
      {perCourseQuery.isSuccess && perCourseQuery.data && perCourseQuery.data.length > 0 && (
        <>
          <h2>{t("ects-reminders-by-course")}</h2>
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
                  <th>{t("label-course-name")}</th>
                  <th>{t("ects-stat-eligible-completions")}</th>
                  <th>{t("ects-stat-finland-eligible")}</th>
                  <th>{t("ects-stat-initial-emails")}</th>
                  <th>{t("ects-stat-follow-up-emails")}</th>
                  <th>{t("ects-stat-registered-after-email")}</th>
                </tr>
              </thead>
              <tbody>
                {perCourseQuery.data.map((row: EctsReminderCourseStats) => (
                  <tr key={row.course_id}>
                    <td>{row.course_name}</td>
                    <td>{formatNumber(row.eligible_completions)}</td>
                    <td>{formatNumber(row.finland_eligible_completions)}</td>
                    <td>{formatNumber(row.initial_emails_sent)}</td>
                    <td>{formatNumber(row.follow_up_emails_sent)}</td>
                    <td>{formatNumber(row.registered_after_email)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export default withErrorBoundary(withSignedIn(EctsRemindersDashboard))
