"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { groupBy } from "lodash"
import React from "react"
import { useTranslation } from "react-i18next"

import { ELLIPSIS } from "../lib/displayConstants"

import { getUserResetExerciseLogsOptions } from "@/generated/api/@tanstack/react-query.generated"
import TimeComponent from "@/shared-module/common/components/TimeComponent"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import { dateToString } from "@/shared-module/common/utils/time"
import { CopyButton, QueryResult } from "@/shared-module/components"

export interface ExerciseResetLogSectionProps {
  userId: string
}

const headingCss = css`
  font-size: ${baseTheme.fontSizes[3]}px;
  font-weight: ${fontWeights.medium};
  margin-bottom: 0.5rem;
`

const groupCss = css`
  border: 1px solid #ced1d7;
  border-radius: 8px;
  margin-bottom: 1rem;
  overflow: hidden;
`

const groupHeaderCss = css`
  background: #f7f8f9;
  padding: 0.6rem 0.9rem;
  font-weight: ${fontWeights.medium};
  color: ${baseTheme.colors.gray[600]};
`

const tableCss = css`
  border-collapse: collapse;
  width: 100%;
  text-align: left;
  font-size: ${baseTheme.fontSizes[0]}px;

  th,
  td {
    padding: 0.6rem 0.9rem;
    border-top: 1px solid #ced1d7;
    color: ${baseTheme.colors.gray[700]};
  }

  th {
    font-weight: ${fontWeights.medium};
    color: ${baseTheme.colors.gray[500]};
  }
`

const idCellCss = css`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-variant-numeric: tabular-nums;
`

const emptyCss = css`
  color: ${baseTheme.colors.gray[500]};
`

/** Teacher/admin audit view: exercises that have been reset for this user, grouped by day. */
const ExerciseResetLogSection: React.FC<ExerciseResetLogSectionProps> = ({ userId }) => {
  const { t } = useTranslation()
  const query = useQuery({ ...getUserResetExerciseLogsOptions({ path: { user_id: userId } }) })

  return (
    <section>
      <h2 className={headingCss}>{t("label-exercise-reset-log")}</h2>
      <QueryResult query={query} treatEmptyAsData>
        {(data) => {
          if (data.length === 0) {
            return <p className={emptyCss}>{t("no-exercise-resets")}</p>
          }
          const grouped = groupBy(data, (log) => dateToString(new Date(log.created_at), false))
          return (
            <div>
              {Object.entries(grouped).map(([day, logs]) => (
                <div key={day} className={groupCss}>
                  <div className={groupHeaderCss}>
                    {t("reset-group-header", {
                      amount: logs.length,
                      firstName: logs[0].reset_by_first_name,
                      lastName: logs[0].reset_by_last_name,
                    })}
                  </div>
                  <table className={tableCss}>
                    <thead>
                      <tr>
                        <th scope="col">{t("exercise")}</th>
                        <th scope="col">{t("label-when")}</th>
                        <th scope="col">{t("label-reason")}</th>
                        <th scope="col">{t("label-exercise-id")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id}>
                          <td>{log.exercise_name}</td>
                          <td>
                            <TimeComponent date={new Date(log.created_at)} boldLabel={false} />
                          </td>
                          <td>{log.reason ?? t("label-not-specified")}</td>
                          <td>
                            <span className={idCellCss}>
                              {`${log.exercise_id.slice(0, 8)}${ELLIPSIS}`}
                              <CopyButton value={log.exercise_id} label={t("copy-exercise-id")} />
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )
        }}
      </QueryResult>
    </section>
  )
}

export default ExerciseResetLogSection
