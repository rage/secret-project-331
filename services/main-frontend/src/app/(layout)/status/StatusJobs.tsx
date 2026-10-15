"use client"

import { css } from "@emotion/css"
import { CheckCircle, Clock, XmarkCircle } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import { DENSITY_COMPACT } from "@/components/credit-registration/constants"
import { useStatusJobs } from "@/hooks/useStatusJobs"
import { baseTheme } from "@/shared-module/common/styles"
import { QueryResult, Table } from "@/shared-module/components"

const iconRowCss = css`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`

const StatusJobs: React.FC = () => {
  const { t } = useTranslation()
  const statusJobsQuery = useStatusJobs()

  return (
    <QueryResult query={statusJobsQuery} emptyFallback={<p>{t("status-no-jobs-found")}</p>}>
      {(jobs) => (
        <Table
          caption={t("status-jobs")}
          density={DENSITY_COMPACT}
          rowHover
          rows={jobs}
          rowKey={(job) => job.name}
          className={css`
            margin-top: 1rem;
          `}
          columns={[
            { header: t("status-name"), cell: (job) => job.name },
            {
              header: t("status-succeeded"),
              cell: (job) => (
                <div className={iconRowCss}>
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
              ),
            },
            {
              header: t("status-failed-count"),
              cell: (job) => {
                const hasFailures = (job.failed ?? 0) > 0
                return (
                  <div className={iconRowCss}>
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
                )
              },
            },
            {
              header: t("status-active"),
              cell: (job) => {
                const isActive = (job.active ?? 0) > 0
                return (
                  <div className={iconRowCss}>
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
                )
              },
            },
          ]}
        />
      )}
    </QueryResult>
  )
}

export default StatusJobs
