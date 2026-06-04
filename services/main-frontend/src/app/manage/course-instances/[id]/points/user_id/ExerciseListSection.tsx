"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { LockKeyhole, Pen, UnlockKeyhole } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import ExerciseAccordion from "./ExerciseAccordion"

import type { ExerciseStatusSummaryForUser } from "@/generated/api/types.generated"
import { useCourseStructure } from "@/hooks/useCourseStructure"
import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import Spinner from "@/shared-module/common/components/Spinner"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { QueryResult } from "@/shared-module/components"
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

  return (
    <QueryResult query={courseStructure}>
      {(courseStructureData) => {
        const sortedChapters = [...courseStructureData.chapters].sort(
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
                  const chapter1 = courseStructureData.chapters.find((ch) => ch.id === c1Id)
                  const chapter2 = courseStructureData.chapters.find((ch) => ch.id === c2Id)
                  return (
                    (chapter1?.chapter_number ?? Infinity) - (chapter2?.chapter_number ?? Infinity)
                  )
                })
                .map(([chapterId, exerciseStatusListUnsorted]) => {
                  const chapter = chapterById[chapterId]
                  const chapterLockStatus = chapterLockStatusesByChapterId?.[chapterId]
                  const isChapterLocked = chapterLockStatus !== "unlocked"

                  const exerciseStatusList = exerciseStatusListUnsorted
                    .sort((a, b) => a.exercise.order_number - b.exercise.order_number)
                    .sort((a, b) => {
                      const aPage = courseStructureData.pages.find(
                        (p) => p.id === a.exercise.page_id,
                      )
                      const bPage = courseStructureData.pages.find(
                        (p) => p.id === b.exercise.page_id,
                      )
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
                        {chapterLockingEnabled && (
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
                                display: inline-flex;
                                align-items: center;
                                gap: 0.4rem;
                              `}
                            >
                              {isChapterLocked ? (
                                <LockKeyhole size={20} />
                              ) : (
                                <UnlockKeyhole size={20} />
                              )}
                              {getTeacherChapterLockLabel(t, chapterLockStatus)}
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
                        )}
                      </div>
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
                buttons={[
                  {
                    variant: "secondary",
                    onClick: closeStatusEditor,
                    disabled: isSavingEditorStatus,
                    children: t("button-text-cancel"),
                  },
                  {
                    variant: "primary",
                    onClick: () => {
                      void saveEditedStatus()
                    },
                    disabled: isSavingEditorStatus,
                    children: isSavingEditorStatus ? (
                      <Spinner variant="small" />
                    ) : (
                      t("button-text-save")
                    ),
                  },
                ]}
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

                  <SelectField
                    id="teacher-chapter-status-select"
                    data-testid="teacher-chapter-status-select"
                    defaultValue={editorStatus}
                    label={t("teacher-chapter-status-select-label")}
                    onChangeByValue={(value) => {
                      setEditorStatus(value as TeacherChapterLockStatus)
                    }}
                    options={teacherChapterLockStatuses.map((status) => ({
                      value: status,
                      label: getTeacherChapterLockLabel(t, status),
                    }))}
                    className={css`
                      margin-bottom: 0;
                    `}
                  />
                </div>
              </StandardDialog>
            )}
          </Section>
        )
      }}
    </QueryResult>
  )
}

export default ExerciseListSection
