import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { parseISO } from "date-fns"
import { groupBy } from "lodash"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { getUserResetExerciseLogs } from "@/services/backend/users"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme, fontWeights, secondaryFont } from "@/shared-module/common/styles"
import { dateToString, relativeTimeFromTimestamp } from "@/shared-module/common/utils/time"

export interface ExerciseResetLogListProps {
  userId: string
}

const ExerciseResetLogList: React.FC<ExerciseResetLogListProps> = ({ userId }) => {
  const { t } = useTranslation()
  const userResetExerciseLogs = useQuery({
    queryKey: ["user-reset-exercise-logs", userId],
    queryFn: () => getUserResetExerciseLogs(userId),
  })

  const groupedLogs = useMemo(() => {
    return groupBy(userResetExerciseLogs.data, (log) => dateToString(log.created_at))
  }, [userResetExerciseLogs.data])

  if (userResetExerciseLogs.isError) {
    return <ErrorBanner variant="readOnly" error={userResetExerciseLogs.error} />
  }
  if (userResetExerciseLogs.isLoading) {
    return <Spinner variant="medium" />
  }

  return (
    <div
      className={css`
        margin-top: 1rem;
      `}
    >
      {Object.entries(groupedLogs).map(([date, logs]) => (
        <div
          key={date}
          className={css`
            border: 1px solid #ced1d7;
            border-radius: 8px;
            border-width: 1px;
            color: ${baseTheme.colors.gray[700]};
            margin-bottom: 21px;
          `}
        >
          <div
            className={css`
              border-radius: 8px;
              background: #f7f8f9;
              padding-left: 14px;
              opacity: 0.8;
              font-family: ${secondaryFont};
            `}
          >
            <p
              className={css`
                padding-top: 10px;
                font-weight: ${fontWeights.medium};
              `}
            >
              {t("title-reset-amount-exercises", { amount: logs.length })}
            </p>
            <p
              className={css`
                padding-bottom: 14px;
                font-weight: ${fontWeights.normal};
                font-size: ${baseTheme.fontSizes[0]}px;
              `}
            >
              {/* eslint-disable-next-line i18next/no-literal-string */}
              {logs[0].reset_by_first_name} {logs[0].reset_by_last_name} ∙{" "}
              {relativeTimeFromTimestamp(date)}
            </p>
          </div>

          <table
            className={css`
              border-collapse: collapse;
              width: 100%;
              text-align: left;

              th {
                font-weight: ${fontWeights.medium};
              }
              ,
              td,
              th {
                font-size: ${baseTheme.fontSizes[0]}px;
                padding: 1rem;
                border-top: 1px solid #ced1d7;
                opacity: 0.8;
              }
            `}
          >
            <thead>
              <tr>
                <th>{t("exercise")}</th>
                <th>{t("label-created-at")}</th>
                <th>{t("label-exercise-id")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.exercise_name}</td>
                  <td>{parseISO(log.created_at).toLocaleString()}</td>
                  <td>{log.exercise_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

export default ExerciseResetLogList
