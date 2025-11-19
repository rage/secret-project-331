import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { useStatusCronJobs } from "../../../hooks/useStatusCronJobs"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"

const StatusCronJobs: React.FC = () => {
  const { t } = useTranslation()
  const { data: cronJobs, isLoading, error } = useStatusCronJobs()

  if (isLoading) {
    return <Spinner />
  }

  if (error) {
    return <ErrorBanner error={error} />
  }

  if (!cronJobs || cronJobs.length === 0) {
    return <p>{t("status-no-cronjobs-found")}</p>
  }

  return (
    <div
      className={css`
        overflow-x: auto;
      `}
    >
      <table
        className={css`
          width: 100%;
          border-collapse: collapse;
          margin-top: 1rem;

          th,
          td {
            padding: 0.5rem;
            text-align: left;
            border-bottom: 1px solid ${baseTheme.colors.clear[300]};
          }

          th {
            background-color: ${baseTheme.colors.clear[100]};
            font-weight: 600;
          }

          tr:hover {
            background-color: ${baseTheme.colors.clear[200]};
          }
        `}
      >
        <thead>
          <tr>
            <th>{t("status-name")}</th>
            <th>{t("status-schedule")}</th>
            <th>{t("status-last-schedule-time")}</th>
          </tr>
        </thead>
        <tbody>
          {cronJobs.map((cronJob) => (
            <tr key={cronJob.name}>
              <td>{cronJob.name}</td>
              <td>{cronJob.schedule}</td>
              <td>{cronJob.last_schedule_time || t("status-never")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default StatusCronJobs
