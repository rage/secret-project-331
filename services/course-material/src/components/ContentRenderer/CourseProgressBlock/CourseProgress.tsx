import { css } from "@emotion/css"
import React from "react"
import { useQuery } from "react-query"

import { fetchUserCourseProgress } from "../../../services/backend"
import { normalWidthCenteredComponentStyles } from "../../../styles/componentStyles"
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
    <div
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      <div>
        Total points: {data.score_given} / {data.score_maximum}
      </div>
      <div>
        Total exercises: {data.completed_exercises} / {data.total_exercises}
      </div>
    </div>
  )
}

export default CourseProgress
