import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import useQueryParameter from "../../../hooks/useQueryParameter"
import { fetchChaptersPagesWithExercises } from "../../../services/backend"
import dontRenderUntilQueryParametersReady from "../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import GenericLoading from "../../GenericLoading"

import PageExerciseList from "./PageExerciseList"

const ExercisesInChapter: React.FC<{ chapterId: string }> = ({ chapterId }) => {
  const { t } = useTranslation()
  const { isLoading, error, data } = useQuery(`chapter-${chapterId}-pages-with-exercises`, () =>
    fetchChaptersPagesWithExercises(chapterId),
  )
  const courseSlug = useQueryParameter("courseSlug")

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
          margin-bottom: 1rem;
          text-transform: uppercase;
        `}
      >
        {t("exercises-in-this-chapter")}
      </h4>
      {data.map((page) => (
        <div key={page.id}>
          <PageExerciseList page={page} courseSlug={courseSlug} />
        </div>
      ))}
    </div>
  )
}

export default dontRenderUntilQueryParametersReady(ExercisesInChapter)
