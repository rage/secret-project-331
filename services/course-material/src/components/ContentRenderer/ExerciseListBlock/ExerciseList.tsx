import { useQuery } from "react-query"
import { fetchChaptersExercises } from "../../../services/backend"
import React from "react"
import GenericLoading from "../../GenericLoading"
import PageWithExercises from "./PageWithExercises"

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

  return (
    <>
      <h3>List of all chapters exercises in every page</h3>
      {data.map((page) => (
        <div key={page.id}>
          <PageWithExercises page={page} />
        </div>
      ))}
    </>
  )
}

export default ExerciseList
