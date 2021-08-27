import { css } from "@emotion/css"
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
    <div
      className={css`
        padding: 0em 1em 5em 1em;
      `}
    >
      <h4
        className={css`
          text-align: center;
        `}
      >
        EXERCISES IN THIS CHAPTER
      </h4>
      {data.map((page) => (
        <div key={page.id}>
          <PageExerciseList page={page} />
        </div>
      ))}
    </div>
  )
}

export default ExerciseList
