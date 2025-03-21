import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { getUserResetExerciseLogs } from "@/services/backend/users"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { dateToString } from "@/shared-module/common/utils/time"

export interface ExerciseResetLogListProps {
  userId: string
}

const ExerciseResetLogList: React.FC<ExerciseResetLogListProps> = ({ userId }) => {
  const { t } = useTranslation()
  const userResetExerciseLogs = useQuery({
    queryKey: ["user-reset-exercise-logs", userId],
    queryFn: () => getUserResetExerciseLogs(userId),
  })
  if (userResetExerciseLogs.isError) {
    return <ErrorBanner variant="readOnly" error={userResetExerciseLogs.error} />
  }
  if (userResetExerciseLogs.isPending) {
    return <Spinner variant="medium" />
  }
  return (
    <div>
      {userResetExerciseLogs.data.map((log) => (
        <div
          key={log.id}
          className={css`
            padding: 1rem;
            margin: 1rem 0;
            border: 1px solid #ccc;
          `}
        >
          <div
            className={css`
              margin-bottom: 0.5rem;
            `}
          >
            <p>
              {t("label-exercise-id")}: {log.exercise_id}
            </p>
            <p>
              {t("label-reset-by")}: {log.reset_by}
            </p>
            <p>
              {t("course-id")}: {log.course_id}
            </p>
            <p>
              {t("label-created-at")}: {dateToString(log.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default ExerciseResetLogList
