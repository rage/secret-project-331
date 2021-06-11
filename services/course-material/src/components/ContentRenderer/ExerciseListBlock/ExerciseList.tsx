import { useQuery } from "react-query"
import { fetchChaptersExercises } from "../../../services/backend"
import React from "react"
import GenericLoading from "../../GenericLoading"

const ExerciseList: React.FC<{ chapterId: string }> = ({ chapterId }) => {
  const { isLoading, error, data } = useQuery(`chapter-${chapterId}-exercises`, () =>
    fetchChaptersExercises(chapterId),
  )

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <GenericLoading />
  }

  return <pre>{JSON.stringify(data, undefined, 2)}</pre>
}

export default ExerciseList
