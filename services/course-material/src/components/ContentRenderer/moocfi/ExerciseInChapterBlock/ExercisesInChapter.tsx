import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { fetchChaptersPagesWithExercises } from "../../../../services/backend"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import useQueryParameter from "../../../../shared-module/hooks/useQueryParameter"
import { headingFont } from "../../../../shared-module/styles"
import { INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS } from "../../../../shared-module/utils/constants"
import dontRenderUntilQueryParametersReady from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"

import ChapterExerciseListGroupedByPage from "./ChapterExerciseListGroupedByPage"

const ExercisesInChapter: React.FC<
  React.PropsWithChildren<{ chapterId: string; courseInstanceId: string | undefined }>
> = ({ chapterId, courseInstanceId }) => {
  const { t } = useTranslation()
  const getChaptersPagesWithExercises = useQuery(
    [`chapter-${chapterId}-pages-with-exercises`],
    () => fetchChaptersPagesWithExercises(chapterId),
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
        className={cx(
          INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS,
          css`
            text-align: center;
            margin-bottom: 2rem;
            font-family: ${headingFont};
            color: #1a2333;
            font-weight: 500;
            font-size: clamp(30px, 2vw, 2.4rem);
          `,
        )}
      >
        {t("exercises-in-this-chapter")}
      </h2>
      {getChaptersPagesWithExercises.isError && (
        <ErrorBanner variant={"readOnly"} error={getChaptersPagesWithExercises.error} />
      )}
      {getChaptersPagesWithExercises.isLoading && <Spinner variant={"medium"} />}
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
