import { css } from "@emotion/css"
import React from "react"
import { useQuery } from "react-query"

import { fetchUserCourseProgress } from "../../../services/backend"
import ScoreBoard from "../../../shared-module/components/CourseProgress/ScoreBoard"
import { normalWidthCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"
import GenericLoading from "../../GenericLoading"

interface CourseProgressProps {
  courseInstanceId: string
}

const CourseProgress: React.FC<CourseProgressProps> = ({ courseInstanceId }) => {
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
    <div className={normalWidthCenteredComponentStyles}>
      <div
        className={css`
          width: 100%;
          margin: 0 auto;
          text-align: center;
          padding: 2em 0;
        `}
      >
        <ScoreBoard
          max={data.score_maximum}
          min={data.score_given}
          point={50}
          label="STUDENT PROGRESS"
        />
      </div>
    </div>
  )
}

export default CourseProgress
