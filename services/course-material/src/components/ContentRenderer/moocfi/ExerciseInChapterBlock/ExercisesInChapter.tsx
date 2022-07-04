import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchChaptersPagesWithExercises } from "../../../../services/backend"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import useQueryParameter from "../../../../shared-module/hooks/useQueryParameter"
import { headingFont } from "../../../../shared-module/styles"
import dontRenderUntilQueryParametersReady from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"

import ChapterExerciseListGroupedByPage from "./ChapterExerciseListGroupedByPage"

const ExercisesInChapter: React.FC<{ chapterId: string; courseInstanceId: string | undefined }> = ({
  chapterId,
  courseInstanceId,
}) => {
  const { t } = useTranslation()
  const getChaptersPagesWithExercises = useQuery(`chapter-${chapterId}-pages-with-exercises`, () =>
    fetchChaptersPagesWithExercises(chapterId),
  )
  const courseSlug = useQueryParameter("courseSlug")
  const organizationSlug = useQueryParameter("organizationSlug")

  return (
    <div
      className={css`
        margin: 5em 0;
      `}
    >
      <h2
        className={css`
          text-align: center;
          margin-bottom: 2rem;
          font-family: ${headingFont};
          color: #1a2333;
          font-size: 2rem;
        `}
      >
        {t("exercises-in-this-chapter")}
      </h2>
      {getChaptersPagesWithExercises.isError && (
        <ErrorBanner variant={"readOnly"} error={getChaptersPagesWithExercises.error} />
      )}
      {(getChaptersPagesWithExercises.isLoading || getChaptersPagesWithExercises.isIdle) && (
        <Spinner variant={"medium"} />
      )}
      {getChaptersPagesWithExercises.isSuccess && (
        <>
          {getChaptersPagesWithExercises.data.map((page) => (
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
        </>
      )}
    </div>
  )
}

export default dontRenderUntilQueryParametersReady(ExercisesInChapter)
