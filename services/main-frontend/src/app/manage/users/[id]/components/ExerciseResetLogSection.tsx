"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { groupBy } from "lodash"
import React from "react"
import { useTranslation } from "react-i18next"

import { sectionHeadingCss } from "../lib/sectionHeading"

import { getUserResetExerciseLogsOptions } from "@/generated/api/@tanstack/react-query.generated"
import TimeComponent from "@/shared-module/common/components/TimeComponent"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import { CopyButton, QueryResult } from "@/shared-module/components"

export interface ExerciseResetLogSectionProps {
  userId: string
}

// date-fns day pattern for grouping resets (SCREAMING_CASE = not a translatable string).
const DAY_FORMAT = "yyyy-MM-dd"

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
      <h2 className={sectionHeadingCss}>{t("label-exercise-reset-log")}</h2>
      <QueryResult query={query} treatEmptyAsData>
        {(data) => {
          if (data.length === 0) {
            return <p className={emptyCss}>{t("no-exercise-resets")}</p>
          }
          // Group by day and resetter so same-day resets aggregate, but different people or days stay
          // separate and attributed.
          const grouped = groupBy(
            data,
            (log) => `${format(new Date(log.created_at), DAY_FORMAT)}::${log.reset_by ?? ""}`,
          )
          return (
            <div>
              {Object.entries(grouped).map(([groupKey, logs]) => {
                const resetterName = [logs[0].reset_by_first_name, logs[0].reset_by_last_name]
                  .filter(Boolean)
                  .join(" ")
                  .trim()
                return (
                  <div key={groupKey} className={groupCss}>
                    <div className={groupHeaderCss}>
                      {t("reset-group-header", {
                        amount: logs.length,
                        name: resetterName || t("reset-by-unknown-user"),
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
                                {log.exercise_id}
                                <CopyButton value={log.exercise_id} label={t("copy-exercise-id")} />
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
          )
        }}
      </QueryResult>
    </section>
  )
}

export default ExerciseResetLogSection
