"use client"

import { css } from "@emotion/css"
import { CheckCircle, Clock } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import { DENSITY_COMPACT } from "@/components/credit-registration/constants"
import { useStatusCronJobs } from "@/hooks/useStatusCronJobs"
import { baseTheme } from "@/shared-module/common/styles"
import { dateToString } from "@/shared-module/common/utils/time"
import { QueryResult, Table } from "@/shared-module/components"

const iconRowCss = css`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`

const nowrapCss = css`
  white-space: nowrap;
`

const StatusCronJobs: React.FC = () => {
  const { t } = useTranslation()
  const cronJobsQuery = useStatusCronJobs()

  return (
    <QueryResult query={cronJobsQuery} emptyFallback={<p>{t("status-no-cronjobs-found")}</p>}>
      {(cronJobs) => (
        <Table
          caption={t("status-cronjobs")}
          density={DENSITY_COMPACT}
          rowHover
          rows={cronJobs}
          rowKey={(cronJob) => cronJob.name}
          className={css`
            margin-top: 1rem;
          `}
          columns={[
            { header: t("status-name"), cell: (cronJob) => cronJob.name },
            {
              header: t("status-schedule"),
              cell: (cronJob) => (
                <div className={iconRowCss}>
                  <Clock size={16} color={baseTheme.colors.blue[600]} />
                  <span>{cronJob.schedule}</span>
                </div>
              ),
            },
            {
              header: t("status-last-schedule-time"),
              cell: (cronJob) => (
                <div className={iconRowCss}>
                  {cronJob.last_schedule_time && (
                    <CheckCircle size={16} color={baseTheme.colors.green[600]} />
                  )}
                  <span className={nowrapCss}>
                    {cronJob.last_schedule_time
                      ? dateToString(cronJob.last_schedule_time)
                      : t("status-never")}
                  </span>
                </div>
              ),
            },
          ]}
        />
      )}
    </QueryResult>
  )
}

export default StatusCronJobs
