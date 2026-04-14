"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import ExerciseAccordion from "./ExerciseAccordion"

import type { ExerciseStatusSummaryForUser } from "@/generated/api/types.generated"
import { useCourseStructure } from "@/hooks/useCourseStructure"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"
import { getTeacherChapterLockLabel, TeacherChapterLockStatus } from "@/utils/chapterLockingStatus"

const Section = styled.section`
  margin: 3rem 0;
`

interface ExerciseListSectionProps {
  groupedByChapter: [string, ExerciseStatusSummaryForUser[]][]
  courseId: string
  onPointsUpdate: () => void
  chapterLockingEnabled: boolean
  chapterLockStatusesByChapterId?: Record<string, TeacherChapterLockStatus | undefined>
  onLockChapter: (chapterId: string) => void
  onUnlockChapter: (chapterId: string) => void
  lockActionPendingChapterId?: string
}

const ExerciseListSection: React.FC<ExerciseListSectionProps> = ({
  groupedByChapter,
  courseId,
  onPointsUpdate,
  chapterLockingEnabled,
  chapterLockStatusesByChapterId,
  onLockChapter,
  onUnlockChapter,
  lockActionPendingChapterId,
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
          margin-bottom: 1.5rem;
        `}
      >
        {t("link-exercises")}
      </h2>
      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
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
                  display: flex;
                  flex-direction: column;
                  gap: 1rem;
                `}
              >
                <h3
                  className={css`
                    margin-bottom: 0.5rem;
                  `}
                >
                  {t("title-chapter", {
                    "chapter-number": chapter?.chapter_number,
                    "chapter-name": chapter?.name,
                  })}
                </h3>
                {chapterLockingEnabled && (
                  <div
                    className={css`
                      display: flex;
                      align-items: center;
                      gap: 0.75rem;
                      margin-top: -0.4rem;
                      margin-bottom: 0.4rem;
                    `}
                  >
                    <p
                      data-testid={`teacher-chapter-lock-status-${chapterId}`}
                      className={css`
                        margin: 0;
                        color: ${chapterLockStatusesByChapterId?.[chapterId] === "unlocked"
                          ? baseTheme.colors.green[700]
                          : chapterLockStatusesByChapterId?.[chapterId] === "completed_and_locked"
                            ? baseTheme.colors.blue[700]
                            : chapterLockStatusesByChapterId?.[chapterId] === "not_unlocked_yet"
                              ? baseTheme.colors.crimson[700]
                              : baseTheme.colors.gray[600]};
                      `}
                    >
                      {t("teacher-chapter-lock-status-prefix", {
                        status: getTeacherChapterLockLabel(
                          t,
                          chapterLockStatusesByChapterId?.[chapterId],
                        ),
                      })}
                    </p>
                    {chapterLockStatusesByChapterId?.[chapterId] === "completed_and_locked" ? (
                      <Button
                        variant="secondary"
                        size="small"
                        data-testid={`teacher-unlock-chapter-${chapterId}`}
                        onClick={() => onUnlockChapter(chapterId)}
                        disabled={lockActionPendingChapterId === chapterId}
                      >
                        {t("teacher-unlock-chapter")}
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="small"
                        data-testid={`teacher-lock-chapter-${chapterId}`}
                        onClick={() => onLockChapter(chapterId)}
                        disabled={lockActionPendingChapterId === chapterId}
                      >
                        {t("teacher-lock-chapter")}
                      </Button>
                    )}
                  </div>
                )}
                {exerciseStatusList?.map((exerciseStatus) => (
                  <ExerciseAccordion
                    key={exerciseStatus.exercise.id}
                    exerciseStatus={exerciseStatus}
                    onPointsUpdate={onPointsUpdate}
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
