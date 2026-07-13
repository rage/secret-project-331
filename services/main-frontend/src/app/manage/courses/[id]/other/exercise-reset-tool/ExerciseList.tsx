"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  getCourseChaptersOptions,
  getCoursePagesOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { DatabaseChapter, Exercise, Page } from "@/generated/api/types.generated"
import { useExercises } from "@/hooks/useExercises"
import Button from "@/shared-module/common/components/Button"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import { baseTheme, fontWeights, secondaryFont } from "@/shared-module/common/styles"
import { QueryResults } from "@/shared-module/components"

interface Props {
  courseId: string
  selectedExerciseIds: string[]
  setSelectedExerciseIds: React.Dispatch<React.SetStateAction<string[]>>
}

const ExerciseList: React.FC<Props> = ({
  courseId,
  selectedExerciseIds,
  setSelectedExerciseIds,
}) => {
  const { t } = useTranslation()

  const exercisesQuery = useExercises(courseId)

  const chaptersQuery = useQuery({
    ...getCourseChaptersOptions({
      path: {
        course_id: courseId,
      },
    }),
  })

  const pagesQuery = useQuery({
    ...getCoursePagesOptions({
      path: {
        course_id: courseId,
      },
    }),
  })

  const toggleExercise = (exerciseId: string) => {
    setSelectedExerciseIds((prev) =>
      prev.includes(exerciseId) ? prev.filter((id) => id !== exerciseId) : [...prev, exerciseId],
    )
  }

  const exercises = exercisesQuery.data
  const groupedExercises = useMemo(() => {
    if (!exercises) {
      return {}
    }

    return exercises.reduce<Record<string, Record<string, Exercise[]>>>((acc, exercise) => {
      const chapterKey = exercise.chapter_id ?? t("label-no-chapter")
      const pageKey = exercise.page_id ?? t("label-no-page")

      acc[chapterKey] ||= {}
      acc[chapterKey][pageKey] ||= []

      acc[chapterKey][pageKey].push(exercise)

      return acc
    }, {})
  }, [exercises, t])

  const renderContent = (exercises: Exercise[], chapters: DatabaseChapter[], pages: Page[]) => {
    const selectAll = () => {
      const allIds = exercises.map((ex) => ex.id)
      setSelectedExerciseIds(allIds)
    }

    const selectNone = () => {
      setSelectedExerciseIds([])
    }

    const invertSelection = () => {
      const allIds = exercises.map((ex) => ex.id)
      const inverted = allIds.filter((id) => !selectedExerciseIds.includes(id))
      setSelectedExerciseIds(inverted)
    }

    const selectPeerReview = () => {
      const peerIds = exercises.filter((ex) => ex.needs_peer_review).map((ex) => ex.id)
      setSelectedExerciseIds(peerIds)
    }

    const selectSelfReview = () => {
      const selfIds = exercises.filter((ex) => ex.needs_self_review).map((ex) => ex.id)
      setSelectedExerciseIds(selfIds)
    }

    const chapterMap = new Map<string, DatabaseChapter>(chapters.map((ch) => [ch.id, ch]))
    const pageMap = new Map<string, Page>(pages.map((pg) => [pg.id, pg]))

    return (
      <div>
        <h6
          className={css`
            font-weight: ${fontWeights.medium};
            font-family: ${secondaryFont};
            padding-bottom: 20px;
            color: ${baseTheme.colors.gray[700]};
          `}
        >
          {t("title-all-exercises")}
        </h6>

        <div
          className={css`
            display: flex;
            gap: 8px;
          `}
        >
          <Button onClick={selectAll} variant={"green"} size={"small"} transform={"capitalize"}>
            {t("button-select-all")}
          </Button>
          <Button onClick={selectNone} variant={"green"} size={"small"} transform={"capitalize"}>
            {t("button-select-none")}
          </Button>
          <Button
            onClick={invertSelection}
            variant={"green"}
            size={"small"}
            transform={"capitalize"}
          >
            {t("button-invert-selection")}
          </Button>
          <Button
            onClick={selectPeerReview}
            variant={"green"}
            size={"small"}
            transform={"capitalize"}
          >
            {t("button-exercises-with-peer-review")}
          </Button>
          <Button
            onClick={selectSelfReview}
            variant={"green"}
            size={"small"}
            transform={"capitalize"}
          >
            {t("button-exercises-with-self-review")}
          </Button>
        </div>
        <div>
          {Object.entries(groupedExercises)
            .toSorted(([aId], [bId]) => {
              const chapterA = aId !== t("label-no-chapter") ? chapterMap.get(aId) : null
              const chapterB = bId !== t("label-no-chapter") ? chapterMap.get(bId) : null

              if (!chapterA) {
                return 1
              }
              if (!chapterB) {
                return -1
              }
              return chapterA.chapter_number - chapterB.chapter_number
            })
            .map(([chapterId, pagesExercises]) => {
              const chapter = chapterId !== t("label-no-chapter") ? chapterMap.get(chapterId) : null
              const chapterTitle = chapter
                ? `${t("chapter")} ${chapter.chapter_number}: ${chapter.name}`
                : t("label-no-chapter")
              return (
                <div key={chapterId}>
                  <p
                    className={css`
                      font-family: ${secondaryFont};
                      color: ${baseTheme.colors.gray[700]};
                      font-weight: ${fontWeights.medium};
                      font-size: ${baseTheme.fontSizes[0]}px;
                      padding-bottom: 10px;
                      padding-top: 20px;
                    `}
                  >
                    {chapterTitle}
                  </p>
                  <div
                    className={css`
                      border: 1px solid #ced1d7;
                      border-radius: 8px;
                      border-width: 1px;
                      color: ${baseTheme.colors.gray[700]};
                    `}
                  >
                    <table
                      className={css`
                        border-collapse: collapse;
                        width: 100%;
                        text-align: left;

                        th {
                          font-weight: ${fontWeights.medium};
                          background: #f7f8f9;
                          border-radius: 8px;
                        }
                        td {
                          border-top: 1px solid #ced1d7;
                        }
                        td,
                        th {
                          font-size: ${baseTheme.fontSizes[0]}px;
                          padding: 1rem;
                          opacity: 0.8;
                        }
                      `}
                    >
                      <thead>
                        <tr>
                          <th>{t("label-select")}</th>
                          <th>{t("exercise")}</th>
                          <th>{t("title-page")}</th>
                          <th>{t("title-peer-review")}</th>
                          <th>{t("title-self-review")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(pagesExercises)
                          .toSorted(([pageAId], [pageBId]) => {
                            const pageA = pageMap.get(pageAId)
                            const pageB = pageMap.get(pageBId)
                            const orderA = pageA ? pageA.order_number : Number.MAX_VALUE
                            const orderB = pageB ? pageB.order_number : Number.MAX_VALUE
                            return orderA - orderB
                          })
                          .map(([pageId, exercises]) => {
                            return exercises
                              .slice()
                              .toSorted((a, b) => a.order_number - b.order_number)
                              .map((exercise) => (
                                <tr key={exercise.id}>
                                  <td>
                                    <CheckBox
                                      checked={selectedExerciseIds.includes(exercise.id)}
                                      onChange={() => toggleExercise(exercise.id)}
                                      label={""}
                                      className={css`
                                        margin: 0px;
                                        padding-left: 10px;
                                      `}
                                    />
                                  </td>
                                  <td>{exercise.name}</td>
                                  <td>
                                    {t("title-page")} {pageMap.get(pageId)?.order_number}
                                  </td>
                                  <td>
                                    {exercise.needs_peer_review
                                      ? t("label-true")
                                      : t("label-false")}
                                  </td>
                                  <td>
                                    {exercise.needs_self_review
                                      ? t("label-true")
                                      : t("label-false")}
                                  </td>
                                </tr>
                              ))
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    )
  }

  return (
    <QueryResults
      queries={[exercisesQuery, chaptersQuery, pagesQuery] as const}
      renderData={([exercises, chapters, pages]) => renderContent(exercises, chapters, pages)}
      treatEmptyAsData
    />
  )
}

export default ExerciseList
