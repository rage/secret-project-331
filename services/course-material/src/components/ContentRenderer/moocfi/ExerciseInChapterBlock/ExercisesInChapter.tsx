import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchChaptersPagesWithExercises } from "../../../../services/backend"
import useQueryParameter from "../../../../shared-module/hooks/useQueryParameter"
import dontRenderUntilQueryParametersReady from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import GenericLoading from "../../../GenericLoading"

import ChapterExerciseListGroupedByPage from "./ChapterExerciseListGroupedByPage"

const ExercisesInChapter: React.FC<{ chapterId: string; courseInstanceId: string }> = ({
  chapterId,
  courseInstanceId,
}) => {
  const { t } = useTranslation()
  const { isLoading, error, data } = useQuery(`chapter-${chapterId}-pages-with-exercises`, () =>
    fetchChaptersPagesWithExercises(chapterId),
  )
  const courseSlug = useQueryParameter("courseSlug")
  const organizationSlug = useQueryParameter("organizationSlug")

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <GenericLoading />
  }

  if (!courseSlug || !organizationSlug) {
    return <GenericLoading />
  }

  return (
    <div
      className={css`
        padding: 0em 1em 5em 1em;
      `}
    >
      <h2
        className={css`
          text-align: center;
          margin-bottom: 1rem;
          text-transform: uppercase;
          font-size: 1.25rem;
        `}
      >
        {t("exercises-in-this-chapter")}
      </h2>
      {data.map((page) => (
        <div key={page.id}>
          <ChapterExerciseListGroupedByPage
            page={page}
            courseSlug={courseSlug}
            courseInstanceId={courseInstanceId}
            chapterId={chapterId}
            organizationSlug={organizationSlug}
          />
        </div>
      ))}
    </div>
  )
}

export default dontRenderUntilQueryParametersReady(ExercisesInChapter)
