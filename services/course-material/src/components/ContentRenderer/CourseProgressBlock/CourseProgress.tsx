import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchUserCourseProgress } from "../../../services/backend"
import CircularProgress from "../../../shared-module/components/CourseProgress/CircularProgress"
import { courseMaterialCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"
import GenericLoading from "../../GenericLoading"

interface CourseProgressProps {
  courseInstanceId: string
}

const CourseProgress: React.FC<CourseProgressProps> = ({ courseInstanceId }) => {
  const { t } = useTranslation()
  const { isLoading, error, data } = useQuery(`course-instance-${courseInstanceId}-progress`, () =>
    fetchUserCourseProgress(courseInstanceId),
  )

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <GenericLoading />
  }

  return (
    <div className={courseMaterialCenteredComponentStyles}>
      <div
        className={css`
          width: 100%;
          margin: 0 auto;
          text-align: center;
          padding: 2em 0;
        `}
      >
        <CircularProgress
          max={data.score_maximum}
          min={data.score_given}
          point={50}
          label={t("student-progress")}
        />
      </div>
    </div>
  )
}

export default CourseProgress
