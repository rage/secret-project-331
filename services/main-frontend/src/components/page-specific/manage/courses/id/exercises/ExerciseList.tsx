import { css } from "@emotion/css"
import { groupBy, mapValues } from "lodash"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { useCourseStructure } from "../../../../../../hooks/useCourseStructure"
import { fetchCourseExercisesAndCountOfAnswersRequiringAttention } from "../../../../../../services/backend/courses"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"

export interface ExerciseListProps {
  courseId: string
}

const ExerciseList: React.FC<ExerciseListProps> = ({ courseId }) => {
  const { t } = useTranslation()
  const getCourseExercises = useQuery(`course-${courseId}-exercises`, () =>
    fetchCourseExercisesAndCountOfAnswersRequiringAttention(courseId),
  )
  const courseStructure = useCourseStructure(courseId)

  if (getCourseExercises.isError) {
    return <ErrorBanner variant={"readOnly"} error={getCourseExercises.error} />
  }

  if (courseStructure.isError) {
    return <ErrorBanner variant={"readOnly"} error={courseStructure.error} />
  }

  if (
    getCourseExercises.isLoading ||
    getCourseExercises.isIdle ||
    courseStructure.isLoading ||
    courseStructure.isIdle
  ) {
    return <Spinner variant={"medium"} />
  }

  const chapterById = mapValues(
    groupBy(courseStructure.data.chapters, (chapter) => chapter.id),
    (value) => value[0],
  )

  const pageById = mapValues(
    groupBy(courseStructure.data.pages, (page) => page.id),
    (value) => value[0],
  )

  return (
    <>
      <ul>
        {getCourseExercises.data
          .sort(
            (ex1, ex2) =>
              (chapterById[ex1.chapter_id ?? "null"]?.chapter_number ?? Number.MAX_VALUE) -
              (chapterById[ex2.chapter_id ?? "null"]?.chapter_number ?? Number.MAX_VALUE),
          )
          .sort(
            (ex1, ex2) =>
              (pageById[ex1.page_id ?? "null"]?.order_number ?? Number.MAX_VALUE) -
              (pageById[ex2.page_id ?? "null"]?.order_number ?? Number.MAX_VALUE),
          )
          .sort((ex1, ex2) => ex1.order_number - ex2.order_number)
          .map((x) => (
            <li key={x.id}>
              {x.name}{" "}
              <Link
                href={{
                  pathname: "/manage/exercises/[exerciseId]/submissions",
                  query: { exerciseId: x.id },
                }}
              >
                {t("link-view-submissions")}
              </Link>
              <span
                className={css`
                  margin-left: 1rem;
                `}
              ></span>
              <Link
                href={{
                  pathname: "/manage/exercises/[exerciseId]/answers-requiring-attention",
                  query: { exerciseId: x.id },
                }}
              >
                {t("link-view-answers-requiring-attention")}
              </Link>
              {x.count !== null ? (
                <span
                  className={css`
                    margin-left: 0.5em;
                  `}
                >
                  ({x.count})
                </span>
              ) : null}
            </li>
          ))}
      </ul>
    </>
  )
}

export default ExerciseList
