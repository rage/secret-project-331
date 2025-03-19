import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { useExercises } from "@/hooks/useExercises"
import { fetchAllChaptersByCourseId } from "@/services/backend/chapters"
import { fetchAllPagesByCourseId } from "@/services/backend/pages"
import { DatabaseChapter, Exercise, Page } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import { baseTheme, fontWeights, headingFont } from "@/shared-module/common/styles"
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

  if (exercisesLoading || chaptersLoading || pagesLoading) {
    return <p>{t("loading-text")}</p>
  }
  if (exercisesError || chaptersError || pagesError) {
    return <p>{t("label-error-loading")}</p>
  }
  if (!exercises || !chapters || !pages) {
    return <p>{t("label-no-chapter")}</p>
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

  const groupedExercises = exercises.reduce(
    (acc, exercise) => {
      const chapterKey = exercise.chapter_id ? exercise.chapter_id : t("label-no-chapter")
      if (!acc[chapterKey]) {
        acc[chapterKey] = {}
      }
      const chapterGroup = acc[chapterKey]
      const pageKey = exercise.page_id ? exercise.page_id : t("label-no-page")
      if (!chapterGroup[pageKey]) {
        chapterGroup[pageKey] = []
      }
      chapterGroup[pageKey].push(exercise)
      return acc
    },
    {} as Record<string, Record<string, Exercise[]>>,
  )

  return (
    <div>
      <h2>{t("title-all-exercises")}</h2>

      <div
        className={css`
          padding-bottom: 0.4rem;
        `}
      >
        <Button onClick={selectAll} variant={"primary"} size={"medium"}>
          {t("button-select-all")}
        </Button>
        <Button onClick={selectNone} variant={"primary"} size={"medium"}>
          {t("button-select-none")}
        </Button>
        <Button onClick={invertSelection} variant={"primary"} size={"medium"}>
          {t("button-invert-selection")}
        </Button>
        <Button onClick={selectPeerReview} variant={"primary"} size={"medium"}>
          {t("button-exercises-with-peer-review")}
        </Button>
        <Button onClick={selectSelfReview} variant={"primary"} size={"medium"}>
          {t("button-exercises-with-self-review")}
        </Button>
      </div>
      <div>
        {Object.entries(groupedExercises).map(([chapterId, pagesExercises]) => {
          const chapter = chapterId !== "no-chapter" ? chapterMap.get(chapterId) : null
          const chapterTitle = chapter
            ? `${t("chapter")} ${chapter.chapter_number}: ${chapter.name}`
            : t("label-no-chapter")

          return (
            <div key={chapterId}>
              <h2
                className={css`
                  font-style: normal;
                  font-weight: ${fontWeights.semibold};
                  padding: 0.4rem;

                  color: ${baseTheme.colors.primary[200]};
                `}
              >
                {chapterTitle}
              </h2>
              <div
                className={css`
                  border-left: 1px solid ${baseTheme.colors.gray[400]};
                  border-right: 1px solid ${baseTheme.colors.gray[400]};
                  border-top: 1px solid ${baseTheme.colors.gray[400]};
                `}
              >
                {Object.entries(pagesExercises)
                  .sort(([pageAId], [pageBId]) => {
                    const pageA = pageMap.get(pageAId)
                    const pageB = pageMap.get(pageBId)
                    const orderA = pageA ? pageA.order_number : Number.MAX_VALUE
                    const orderB = pageB ? pageB.order_number : Number.MAX_VALUE
                    return orderA - orderB
                  })
                  .map(([pageId, exercises]) => {
                    const page = pageId !== "no-page" ? pageMap.get(pageId) : null
                    const pageTitle = page
                      ? `${t("label-page")} ${page.order_number}`
                      : t("label-no-page")
                    return (
                      <div
                        key={pageId}
                        className={css`
                          border-bottom: 1px solid ${baseTheme.colors.gray[400]};
                          padding: 0.4rem;
                        `}
                      >
                        <h3
                          className={css`
                            color: ${baseTheme.colors.gray[700]};
                            font-family: ${headingFont};
                            padding: 0.4rem;
                          `}
                        >
                          {pageTitle}
                        </h3>
                        <ul
                          className={css`
                            list-style-type: none;
                          `}
                        >
                          {exercises.map((exercise) => (
                            <li key={exercise.id}>
                              <CheckBox
                                label={exercise.name}
                                checked={selectedExerciseIds.includes(exercise.id)}
                                onChange={() => toggleExercise(exercise.id)}
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ExerciseList
