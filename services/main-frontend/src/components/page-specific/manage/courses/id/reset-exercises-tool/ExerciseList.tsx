import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useExercises } from "@/hooks/useExercises"
import { fetchAllChaptersByCourseId } from "@/services/backend/chapters"
import { fetchAllPagesByCourseId } from "@/services/backend/pages"
import { DatabaseChapter, Exercise, Page } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme, fontWeights, secondaryFont } from "@/shared-module/common/styles"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

type Props = {
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

  const {
    data: exercises,
    isLoading: exercisesLoading,
    error: exercisesError,
  } = useExercises(courseId)

  const {
    data: chapters,
    isLoading: chaptersLoading,
    error: chaptersError,
  } = useQuery({
    queryKey: [`/chapters/${courseId}/all-chapters-by-course-id`],
    queryFn: () => fetchAllChaptersByCourseId(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })

  const {
    data: pages,
    isLoading: pagesLoading,
    error: pagesError,
  } = useQuery({
    queryKey: [`/pages/${courseId}/all-course-pages-by-course-id`],
    queryFn: () => fetchAllPagesByCourseId(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })

  const toggleExercise = (exerciseId: string) => {
    setSelectedExerciseIds((prev) =>
      prev.includes(exerciseId) ? prev.filter((id) => id !== exerciseId) : [...prev, exerciseId],
    )
  }

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

  if (exercisesLoading || chaptersLoading || pagesLoading) {
    return <Spinner variant="medium" />
  }
  if (exercisesError || chaptersError || pagesError) {
    return <ErrorBanner error={exercisesError || chaptersError || pagesError} />
  }
  if (!exercises || !chapters || !pages) {
    return <ErrorBanner error={t("label-no-chapter")} />
  }

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
        <Button onClick={invertSelection} variant={"green"} size={"small"} transform={"capitalize"}>
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
        {Object.entries(groupedExercises).map(([chapterId, pagesExercises]) => {
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
                      .sort(([pageAId], [pageBId]) => {
                        const pageA = pageMap.get(pageAId)
                        const pageB = pageMap.get(pageBId)
                        const orderA = pageA ? pageA.order_number : Number.MAX_VALUE
                        const orderB = pageB ? pageB.order_number : Number.MAX_VALUE
                        return orderA - orderB
                      })
                      .map(([pageId, exercises]) => {
                        return exercises.map((exercise) => (
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
                              {exercise.needs_peer_review ? t("label-true") : t("label-false")}
                            </td>
                            <td>
                              {exercise.needs_self_review ? t("label-true") : t("label-false")}
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

export default ExerciseList
