import React from "react"
import { useQuery } from "react-query"
import { fetchCourseProgress } from "../../../services/backend"
import GenericLoading from "../../GenericLoading"

interface CourseProgressProps {
  courseInstanceId: string
}

const CourseProgress: React.FC<CourseProgressProps> = ({ courseInstanceId }) => {
  const { isLoading, error, data } = useQuery(`course-instance-${courseInstanceId}-progress`, () =>
    fetchCourseProgress(courseInstanceId),
  )

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <GenericLoading />
  }

  return (
    <div>
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
