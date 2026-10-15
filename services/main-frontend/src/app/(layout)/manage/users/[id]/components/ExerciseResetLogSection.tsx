"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { groupBy } from "lodash"
import React from "react"
import { useTranslation } from "react-i18next"

import { DENSITY_COMPACT } from "@/components/credit-registration/constants"
import { emptyStateCss } from "@/components/credit-registration/styles"
import { getUserResetExerciseLogsOptions } from "@/generated/api/@tanstack/react-query.generated"
import TimeComponent from "@/shared-module/common/components/TimeComponent"
import { CopyButton, QueryResult, Table } from "@/shared-module/components"

export interface ExerciseResetLogSectionProps {
  userId: string
}

// Local calendar day of an instant, used to group resets. Grouping is local (not UTC) so it matches the
// locally-displayed timestamps in each row (rendered by TimeComponent in the viewer's zone); a UTC key
// would split same-local-day resets across cards, or merge rows showing two different local dates.
const localDay = (iso: string): string => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

const groupCss = css`
  margin-bottom: 1rem;
`

const idCellCss = css`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-variant-numeric: tabular-nums;
`

/** Teacher/admin audit view: exercises that have been reset for this user, grouped by day. */
const ExerciseResetLogSection: React.FC<ExerciseResetLogSectionProps> = ({ userId }) => {
  const { t } = useTranslation()
  const query = useQuery({ ...getUserResetExerciseLogsOptions({ path: { user_id: userId } }) })

  return (
    <QueryResult query={query} treatEmptyAsData>
      {(data) => {
        if (data.length === 0) {
          return <p className={emptyStateCss}>{t("no-exercise-resets")}</p>
        }
        // Group by local day + resetter, so same-day resets by one person aggregate and the
        // rest stay separate.
        const grouped = groupBy(data, (log) => `${localDay(log.created_at)}::${log.reset_by ?? ""}`)
        return (
          <div>
            {Object.entries(grouped).map(([groupKey, logs]) => {
              const resetterName = [logs[0]?.reset_by_first_name, logs[0]?.reset_by_last_name]
                .filter(Boolean)
                .join(" ")
                .trim()
              return (
                <div key={groupKey} className={groupCss}>
                  <Table
                    caption={t("reset-group-header", {
                      amount: logs.length,
                      name: resetterName || t("reset-by-unknown-user"),
                    })}
                    showCaption
                    density={DENSITY_COMPACT}
                    rows={logs}
                    rowKey={(log) => log.id}
                    columns={[
                      { header: t("exercise"), cell: (log) => log.exercise_name },
                      {
                        header: t("label-when"),
                        cell: (log) => (
                          <TimeComponent date={new Date(log.created_at)} boldLabel={false} />
                        ),
                      },
                      {
                        header: t("label-reason"),
                        cell: (log) => log.reason ?? t("label-not-specified"),
                      },
                      {
                        header: t("label-exercise-id"),
                        cell: (log) => (
                          <span className={idCellCss}>
                            {log.exercise_id}
                            <CopyButton value={log.exercise_id} label={t("copy-exercise-id")} />
                          </span>
                        ),
                      },
                    ]}
                  />
                </div>
              )
            })}
          </div>
        )
      }}
    </QueryResult>
  )
}

export default ExerciseResetLogSection
