"use client"

import { css } from "@emotion/css"
import { CheckCircle, Clock, XmarkCircle } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import { useStatusJobs } from "@/hooks/useStatusJobs"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"

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
                  ${hasFailures
                    ? `background-color: ${baseTheme.colors.red[100]};`
                    : isActive
                      ? `background-color: ${baseTheme.colors.blue[100]};`
                      : ""}
                `}
              >
                <td>{job.name}</td>
                <td>
                  <div
                    className={css`
                      display: flex;
                      align-items: center;
                      gap: 0.5rem;
                    `}
                  >
                    {(job.succeeded ?? 0) > 0 && (
                      <CheckCircle size={16} color={baseTheme.colors.green[600]} />
                    )}
                    <span
                      className={css`
                        color: ${baseTheme.colors.green[600]};
                        font-weight: ${(job.succeeded ?? 0) > 0 ? "600" : "normal"};
                      `}
                    >
                      {job.succeeded ?? 0}
                    </span>
                  </div>
                </td>
                <td>
                  <div
                    className={css`
                      display: flex;
                      align-items: center;
                      gap: 0.5rem;
                    `}
                  >
                    {hasFailures && <XmarkCircle size={16} color={baseTheme.colors.red[600]} />}
                    <span
                      className={css`
                        color: ${baseTheme.colors.red[600]};
                        font-weight: ${hasFailures ? "600" : "normal"};
                      `}
                    >
                      {job.failed ?? 0}
                    </span>
                  </div>
                </td>
                <td>
                  <div
                    className={css`
                      display: flex;
                      align-items: center;
                      gap: 0.5rem;
                    `}
                  >
                    {isActive && <Clock size={16} color={baseTheme.colors.blue[700]} />}
                    <span
                      className={css`
                        color: ${baseTheme.colors.blue[700]};
                        font-weight: ${isActive ? "600" : "normal"};
                      `}
                    >
                      {job.active ?? 0}
                    </span>
                  </div>
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
