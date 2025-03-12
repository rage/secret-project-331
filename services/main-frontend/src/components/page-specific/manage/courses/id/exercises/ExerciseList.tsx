import { css } from "@emotion/css"
import { groupBy, mapValues } from "lodash"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import useCourseExercisesAndCountAnswersRequitingAttentionQuery from "@/hooks/useCourseExercisesAndCountAnswersRequitingAttentionQuery"
import { useCourseStructure } from "@/hooks/useCourseStructure"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme, fontWeights, monospaceFont, primaryFont } from "@/shared-module/common/styles"

export interface ExerciseListProps {
  courseId: string
}

const ExerciseList: React.FC<React.PropsWithChildren<ExerciseListProps>> = ({ courseId }) => {
  const { t } = useTranslation()
  const getCourseExercises = useCourseExercisesAndCountAnswersRequitingAttentionQuery(courseId)
  const courseStructure = useCourseStructure(courseId)
  if (getCourseExercises.isError) {
    return <ErrorBanner variant={"readOnly"} error={getCourseExercises.error} />
  }

  if (courseStructure.isError) {
    return <ErrorBanner variant={"readOnly"} error={courseStructure.error} />
  }

  if (getCourseExercises.isPending || courseStructure.isPending) {
    return <Spinner variant={"medium"} />
  }

  const pageByChapterId = mapValues(
    groupBy(courseStructure.data.pages, (page) => page.chapter_id),
    (value) => value,
  )

  const chapters = courseStructure.data.chapters.sort((a, b) => a.chapter_number - b.chapter_number)

  return (
    <>
      <ul
        className={css`
          padding: 0;
          list-style-type: none;
        `}
      >
        {chapters.map((chapter) => (
          <li key={chapter.id}>
            <h2
              className={css`
                font-style: normal;
                font-weight: ${fontWeights.semibold};
                font-size: 22px;
                line-height: 100%;
                margin-top: 2rem;
                color: ${baseTheme.colors.primary[200]};
              `}
            >
              {chapter.name}
            </h2>
            <ul
              className={css`
                padding: 0;
                list-style-type: none;
              `}
            >
              {pageByChapterId[chapter.id]
                .sort((page1, page2) => page1.order_number - page2.order_number)
                .map((page) => (
                  <li
                    key={page.id}
                    data-testid="exercise-row"
                    className={css`
                      &:not(:has(ul li)) div {
                        border-bottom-right-radius: 4px;
                        border-bottom-left-radius: 4px;
                      }
                    `}
                  >
                    <div
                      className={css`
                        box-sizing: border-box;
                        background-color: #f7f8f9;
                        border: 2px solid #e1e3e5;
                        margin-top: 20px;
                        padding: 0.8rem 1.25rem;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        border-top-right-radius: 4px;
                        border-top-left-radius: 4px;
                      `}
                    >
                      <h3
                        className={css`
                          font-family: ${primaryFont};
                          font-size: 16px;
                          font-weight: ${fontWeights.semibold};
                          line-height: 160%;
                        `}
                      >
                        {page.title}
                      </h3>
                      <p
                        className={css`
                          font-weight: ${fontWeights.semibold};
                          font-size: 14px;
                          line-height: 24px;
                          text-transform: uppercase;
                          color: ${baseTheme.colors.green[600]};
                        `}
                      >
                        {t("page-number", { "page-number": page.order_number + 1 })}
                      </p>
                    </div>
                    <ul
                      className={css`
                        padding: 0;
                        list-style-type: none;
                        li:last-of-type {
                          border-bottom-right-radius: 4px;
                          border-bottom-left-radius: 4px;
                          border-bottom: 2px solid #e1e3e5;
                        }
                        li:nth-child(even) {
                          border-right: 2px solid #e1e3e5;
                          border-left: 2px solid #e1e3e5;
                        }
                        li:nth-child(odd) {
                          &:first-of-type {
                            border-top: none !important;
                          }
                          border: 2px solid #e1e3e5;
                        }
                      `}
                    >
                      {getCourseExercises.data
                        .filter((ex) => ex.page_id == page.id)
                        .sort((ex1, ex2) => ex1.order_number - ex2.order_number)
                        .map((exercise) => (
                          <li
                            key={exercise.id}
                            className={css`
                              padding: 0.8rem;
                              padding-left: 1.25rem;
                              display: flex;
                              align-items: center;
                              gap: 22px;
                              a:link,
                              a:visited {
                                text-decoration: none;
                                color: ${baseTheme.colors.gray[600]};
                              }
                            `}
                          >
                            <div
                              className={css`
                                font-family: ${primaryFont};
                                font-style: normal;
                                font-weight: 400;
                                font-size: 18px;
                                line-height: 160%;
                              `}
                            >
                              <Link
                                href={{
                                  pathname: "/manage/exercises/[exerciseId]/submissions",
                                  query: { exerciseId: exercise.id },
                                }}
                              >
                                {exercise.name} {exercise.count}
                              </Link>
                            </div>
                            <div>
                              {exercise.count !== null && (
                                <Link
                                  className={css`
                                    font-family: ${monospaceFont};
                                    font-style: normal;
                                    font-weight: ${fontWeights.normal};
                                    font-size: 15px;
                                    line-height: 22px;
                                    color: #1a2333;
                                    background: #ebd7d3;
                                    border-radius: 100px;
                                    padding: 3px 16px 5px;
                                  `}
                                  href={{
                                    pathname:
                                      "/manage/exercises/[exerciseId]/answers-requiring-attention",
                                    query: { exerciseId: exercise.id },
                                  }}
                                >
                                  {t("link-view-answers-requiring-attention")}
                                </Link>
                              )}
                            </div>
                          </li>
                        ))}
                    </ul>
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </>
  )
}

export default ExerciseList
