"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { Pen } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import ExerciseAccordion from "./ExerciseAccordion"

import type { ExerciseStatusSummaryForUser } from "@/generated/api/types.generated"
import { useCourseStructure } from "@/hooks/useCourseStructure"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import {
  defaultTeacherChapterLockStatus,
  getTeacherChapterLockLabel,
  TeacherChapterLockStatus,
  teacherChapterLockStatuses,
} from "@/utils/chapterLockingStatus"

const Section = styled.section`
  margin: 3rem 0;
`

interface ExerciseListSectionProps {
  groupedByChapter: [string, ExerciseStatusSummaryForUser[]][]
  courseId: string
  onPointsUpdate: () => void
  chapterLockingEnabled: boolean
  chapterLockStatusesByChapterId?: Record<string, TeacherChapterLockStatus | undefined>
  onUpdateChapterLockStatus: (chapterId: string, status: TeacherChapterLockStatus) => Promise<void>
  lockActionPendingChapterId?: string
}

const iconButtonStyle = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid ${baseTheme.colors.gray[300]};
  border-radius: 0.4rem;
  background: #fff;
  cursor: pointer;
  color: ${baseTheme.colors.gray[700]};
`

const getEditableStatus = (
  status: TeacherChapterLockStatus | undefined,
): TeacherChapterLockStatus => {
  if (status && teacherChapterLockStatuses.includes(status)) {
    return status
  }
  return defaultTeacherChapterLockStatus
}

const ExerciseListSection: React.FC<ExerciseListSectionProps> = ({
  groupedByChapter,
  courseId,
  onPointsUpdate,
  chapterLockingEnabled,
  chapterLockStatusesByChapterId,
  onUpdateChapterLockStatus,
  lockActionPendingChapterId,
}) => {
  const { t } = useTranslation()
  const courseStructure = useCourseStructure(courseId)
  const [editorChapterId, setEditorChapterId] = useState<string | null>(null)
  const [editorStatus, setEditorStatus] = useState<TeacherChapterLockStatus>(
    defaultTeacherChapterLockStatus,
  )

  if (courseStructure.isError) {
    return <ErrorBanner error={courseStructure.error} />
  }

  if (courseStructure.isLoading) {
    return <Spinner />
  }

  if (!courseStructure.data) {
    return <ErrorBanner error={new Error("Course structure not found")} />
  }

  const sortedChapters = [...courseStructure.data.chapters].sort(
    (chapterA, chapterB) => chapterA.chapter_number - chapterB.chapter_number,
  )
  const chapterById = sortedChapters.reduce<Record<string, (typeof sortedChapters)[number]>>(
    (acc, chapter) => {
      acc[chapter.id] = chapter
      return acc
    },
    {},
  )
  const activeChapter = editorChapterId ? chapterById[editorChapterId] : undefined
  const isSavingEditorStatus =
    Boolean(editorChapterId) && lockActionPendingChapterId === editorChapterId

  const openStatusEditor = (chapterId: string) => {
    setEditorChapterId(chapterId)
    setEditorStatus(getEditableStatus(chapterLockStatusesByChapterId?.[chapterId]))
  }

  const closeStatusEditor = () => {
    if (isSavingEditorStatus) {
      return
    }
    setEditorChapterId(null)
  }

  const saveEditedStatus = async () => {
    if (!editorChapterId) {
      return
    }
    await onUpdateChapterLockStatus(editorChapterId, editorStatus)
    setEditorChapterId(null)
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
            const chapter = chapterById[chapterId]
            const chapterLockStatus = chapterLockStatusesByChapterId?.[chapterId]

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
                {chapterLockingEnabled && (
                  <div
                    className={css`
                      display: flex;
                      flex-direction: column;
                      align-items: flex-start;
                      gap: 0.4rem;
                      margin-bottom: 0.4rem;
                      ${respondToOrLarger.md} {
                        flex-direction: row;
                        justify-content: space-between;
                        align-items: center;
                      }
                    `}
                  >
                    <h3
                      className={css`
                        margin: 0;
                        font-size: 1.1rem;
                      `}
                    >
                      {t("title-chapter", {
                        "chapter-number": chapter?.chapter_number,
                        "chapter-name": chapter?.name,
                      })}
                    </h3>
                    <div
                      className={css`
                        width: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 0.75rem;
                        ${respondToOrLarger.md} {
                          width: auto;
                          justify-content: flex-end;
                        }
                      `}
                    >
                      <p
                        data-testid={`teacher-chapter-lock-status-${chapterId}`}
                        className={css`
                          margin: 0;
                          color: ${baseTheme.colors.gray[700]};
                        `}
                      >
                        {t("teacher-chapter-lock-status-prefix", {
                          status: getTeacherChapterLockLabel(t, chapterLockStatus),
                        })}
                      </p>
                      <button
                        type="button"
                        data-testid={`teacher-edit-chapter-status-${chapterId}`}
                        aria-label={t("teacher-edit-chapter-status")}
                        title={t("teacher-edit-chapter-status")}
                        className={iconButtonStyle}
                        onClick={() => openStatusEditor(chapterId)}
                        disabled={lockActionPendingChapterId === chapterId}
                      >
                        {lockActionPendingChapterId === chapterId ? (
                          <Spinner variant="small" />
                        ) : (
                          <Pen size={16} />
                        )}
                      </button>
                    </div>
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
      {chapterLockingEnabled && (
        <StandardDialog
          open={editorChapterId !== null}
          onClose={closeStatusEditor}
          title={t("teacher-chapter-status-editor-title")}
        >
          <div
            className={css`
              display: flex;
              flex-direction: column;
              gap: 1rem;
              min-width: 18rem;
            `}
          >
            <p
              className={css`
                margin: 0;
              `}
            >
              {activeChapter
                ? t("title-chapter", {
                    "chapter-number": activeChapter.chapter_number,
                    "chapter-name": activeChapter.name,
                  })
                : ""}
            </p>
            <label
              htmlFor="teacher-chapter-status-select"
              className={css`
                font-weight: 500;
              `}
            >
              {t("teacher-chapter-status-select-label")}
            </label>
            <select
              id="teacher-chapter-status-select"
              data-testid="teacher-chapter-status-select"
              value={editorStatus}
              onChange={(event) => {
                setEditorStatus(event.target.value as TeacherChapterLockStatus)
              }}
              className={css`
                border: 1px solid ${baseTheme.colors.gray[300]};
                border-radius: 0.35rem;
                padding: 0.5rem 0.75rem;
                font-size: 0.95rem;
              `}
            >
              {teacherChapterLockStatuses.map((status) => (
                <option key={status} value={status}>
                  {getTeacherChapterLockLabel(t, status)}
                </option>
              ))}
            </select>
            <div
              className={css`
                display: flex;
                justify-content: flex-end;
                gap: 0.75rem;
              `}
            >
              <Button
                variant="secondary"
                size="small"
                onClick={closeStatusEditor}
                disabled={isSavingEditorStatus}
              >
                {t("button-text-cancel")}
              </Button>
              <Button
                variant="primary"
                size="small"
                data-testid="teacher-chapter-status-save-button"
                onClick={() => {
                  void saveEditedStatus()
                }}
                disabled={isSavingEditorStatus}
              >
                {isSavingEditorStatus ? <Spinner variant="small" /> : t("button-text-save")}
              </Button>
            </div>
          </div>
        </StandardDialog>
      )}
    </Section>
  )
}

export default ExerciseListSection
