import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import ExerciseAccordion from "./ExerciseAccordion"

import { useCourseStructure } from "@/hooks/useCourseStructure"
import { ExerciseStatusSummaryForUser } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

const Section = styled.section`
  margin: 2rem 0;
`

interface ExerciseListSectionProps {
  groupedByChapter: [string, ExerciseStatusSummaryForUser[]][]
  courseId: string
}

const ExerciseListSection: React.FC<ExerciseListSectionProps> = ({
  groupedByChapter,
  courseId,
}) => {
  const { t } = useTranslation()
  const courseStructure = useCourseStructure(courseId)

  if (courseStructure.isError) {
    return <ErrorBanner error={courseStructure.error} />
  }

  if (courseStructure.isLoading) {
    return <Spinner />
  }

  if (!courseStructure.data) {
    return <ErrorBanner error={new Error("Course structure not found")} />
  }

  return (
    <Section>
      <h2
        className={css`
          margin-bottom: -2rem;
        `}
      >
        {t("link-exercises")}
      </h2>
      <div
        className={css`
          display: flex;
          flex-direction: column;
        `}
      >
        {groupedByChapter
          .sort(([c1Id, _list1], [c2Id, _list2]) => {
            const chapter1 = courseStructure.data.chapters.find((ch) => ch.id === c1Id)
            const chapter2 = courseStructure.data.chapters.find((ch) => ch.id === c2Id)
            return (chapter1?.chapter_number ?? Infinity) - (chapter2?.chapter_number ?? Infinity)
          })
          .map(([chapterId, exerciseStatusListUnsorted]) => {
            const chapter = courseStructure.data.chapters.find((ch) => ch.id === chapterId)

            const exerciseStatusList = exerciseStatusListUnsorted
              .sort((a, b) => a.exercise.order_number - b.exercise.order_number)
              .sort((a, b) => {
                const aPage = courseStructure.data.pages.find((p) => p.id === a.exercise.page_id)
                const bPage = courseStructure.data.pages.find((p) => p.id === b.exercise.page_id)
                if (aPage && bPage) {
                  return aPage.order_number - bPage.order_number
                }
                return 0
              })

            return (
              <div
                key={chapterId}
                className={css`
                  margin: 2rem 0;
                `}
              >
                <h3
                  className={css`
                    margin-bottom: 1rem;
                  `}
                >
                  {t("title-chapter", {
                    "chapter-number": chapter?.chapter_number,
                    "chapter-name": chapter?.name,
                  })}
                </h3>
                {exerciseStatusList?.map((exerciseStatus) => (
                  <ExerciseAccordion
                    key={exerciseStatus.exercise.id}
                    exerciseStatus={exerciseStatus}
                  />
                ))}
              </div>
            )
          })}
      </div>
    </Section>
  )
}

export default ExerciseListSection
