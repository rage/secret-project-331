import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { useStatusJobs } from "../../../hooks/useStatusJobs"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

const StatusJobs: React.FC = () => {
  const { t } = useTranslation()
  const { data: jobs, isLoading, error } = useStatusJobs()

  if (isLoading) {
    return <Spinner />
  }

  if (error) {
    return <ErrorBanner error={error} />
  }

  if (!jobs || jobs.length === 0) {
    return <p>{t("status-no-jobs-found")}</p>
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
            border-bottom: 1px solid #ddd;
          }

          th {
            background-color: #f5f5f5;
            font-weight: 600;
          }

          tr:hover {
            background-color: #f9f9f9;
          }
        `}
      >
        <thead>
          <tr>
            <th>{t("status-name")}</th>
            <th>{t("status-succeeded")}</th>
            <th>{t("status-failed-count")}</th>
            <th>{t("status-active")}</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const hasFailures = (job.failed ?? 0) > 0
            const isActive = (job.active ?? 0) > 0
            return (
              <tr
                key={job.name}
                className={css`
                  ${hasFailures ? "background-color: #f8d7da;" : ""}
                  ${isActive ? "background-color: #d1ecf1;" : ""}
                `}
              >
                <td>{job.name}</td>
                <td
                  className={css`
                    color: #28a745;
                    font-weight: ${(job.succeeded ?? 0) > 0 ? "600" : "normal"};
                  `}
                >
                  {job.succeeded ?? 0}
                </td>
                <td
                  className={css`
                    color: #dc3545;
                    font-weight: ${hasFailures ? "600" : "normal"};
                  `}
                >
                  {job.failed ?? 0}
                </td>
                <td
                  className={css`
                    color: #0c5460;
                    font-weight: ${isActive ? "600" : "normal"};
                  `}
                >
                  {job.active ?? 0}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default StatusJobs
