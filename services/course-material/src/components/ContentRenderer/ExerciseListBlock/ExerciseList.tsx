import React from "react"
import { useQuery } from "react-query"

import { fetchChaptersPagesWithExercises } from "../../../services/backend"
import GenericLoading from "../../GenericLoading"

import PageExerciseList from "./PageExerciseList"

const ExerciseList: React.FC<{ chapterId: string }> = ({ chapterId }) => {
  const { isLoading, error, data } = useQuery(`chapter-${chapterId}-pages-with-exercises`, () =>
    fetchChaptersPagesWithExercises(chapterId),
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
          <PageExerciseList page={page} />
        </div>
      ))}
    </>
  )
}

export default ExerciseList
