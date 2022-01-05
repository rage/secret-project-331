import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchUserCourseProgress } from "../../../../services/backend"
import CircularProgress from "../../../../shared-module/components/CourseProgress/CircularProgress"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"

interface CourseProgressProps {
  courseInstanceId: string
}

const CourseProgress: React.FC<CourseProgressProps> = ({ courseInstanceId }) => {
  const { t } = useTranslation()
  const getUserCourseProgress = useQuery(`course-instance-${courseInstanceId}-progress`, () =>
    fetchUserCourseProgress(courseInstanceId),
  )

  return (
    <div className={normalWidthCenteredComponentStyles}>
      {getUserCourseProgress.isError && (
        <ErrorBanner variant={"readOnly"} error={getUserCourseProgress.error} />
      )}
      {(getUserCourseProgress.isLoading || getUserCourseProgress.isIdle) && (
        <Spinner variant={"medium"} />
      )}
      {getUserCourseProgress.isSuccess && (
        <div
          className={css`
            width: 100%;
            margin: 0 auto;
            text-align: center;
            padding: 2em 0;
          `}
        >
          {/* TODO: Verify how it looks when score_given is a floating number */}
          <CircularProgress
            max={getUserCourseProgress.data.score_maximum}
            given={getUserCourseProgress.data.score_given}
            point={50}
            label={t("student-progress")}
          />
        </div>
      )}
    </div>
  )
}

export default CourseProgress
