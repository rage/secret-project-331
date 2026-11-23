"use client"

import { css, cx } from "@emotion/css"
import React, { useContext, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type {
  LanguageVersionCourse,
  StructureChapterRow,
  StructureNote,
  StructurePage,
  StructurePageRow,
} from "@/generated/api/types.generated"
import { useLanguageVersionStructure } from "@/hooks/useLanguageVersions"
import useLanguageName from "@/shared-module/common/hooks/useLanguageName"
import { manageCreateCounterpartRoute } from "@/shared-module/common/utils/routes"
import { Button, Checkbox, LanguageChip, Link, QueryResult } from "@/shared-module/components"

import { NOTE_DUPLICATE_IN_GROUP, NOTE_FOREIGN_COURSE_LINK, OUTSIDE_CHAPTERS } from "./constants"
import {
  CanEditAllCoursesContext,
  chipBeforeTextCss,
  leadCss,
  orderCourses,
  pageOfCourse,
  sectionCss,
  toolbarCss,
} from "./shared"

const scrollCss = css`
  overflow-x: auto;
`

const chapterCss = css`
  min-width: 720px;
  border: 1px solid var(--color-gray-100);
  border-radius: var(--control-radius);
  background: #fff;
  overflow: hidden;

  & + & {
    margin-top: var(--space-4);
  }
`

const gridCss = (columns: number) => css`
  display: grid;
  grid-template-columns: repeat(${columns}, minmax(0, 1fr));

  > div {
    padding: var(--space-3) var(--space-4);
    min-width: 0;
  }

  > div + div {
    border-left: 1px solid var(--color-gray-100);
  }
`

const chapterHeadCss = css`
  background: var(--color-gray-50);
  border-bottom: 1px solid var(--color-gray-100);
  font-weight: 600;

  > div {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
`

const rowCss = css`
  border-bottom: 1px solid var(--color-gray-100);

  &:last-child {
    border-bottom: 0;
  }
`

const exerciseRowCss = css`
  font-size: var(--font-size-1);
  color: var(--color-gray-600);

  > div {
    padding-top: var(--space-2);
    padding-bottom: var(--space-2);
    padding-left: calc(var(--space-4) + 1.5rem);
  }
`

const pageLineCss = css`
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
`

const smallMutedCss = css`
  font-size: var(--font-size-1);
  font-weight: 400;
  color: var(--color-gray-500);
`

const positionCss = css`
  flex: none;
  width: 1.25rem;
  font-variant-numeric: tabular-nums;
`

const titleCss = css`
  flex: 1;
  min-width: 0;
`

const countCss = css`
  margin-left: auto;
  white-space: nowrap;
`

const lessCss = css`
  font-weight: 600;
  color: var(--color-gray-700);
`

const noteCss = css`
  display: block;
  margin: var(--space-1) 0 0 calc(1.25rem + var(--space-3));
`

const missingCss = css`
  background: var(--color-red-50);
`

const onlyOneCss = css`
  background: var(--color-blue-50);
`

const differentOrderCss = css`
  background: var(--color-yellow-50);
`

const problemTextCss = css`
  font-weight: 600;
  color: var(--color-red-700);
`

const legendCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  font-size: var(--font-size-1);
  color: var(--color-gray-500);

  span {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  i {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    border: 1px solid var(--color-gray-200);
    border-radius: 2px;
  }
`

interface Props {
  courseId: string
}

interface Fields {
  isDifferencesOnly: boolean
}

function hasNote(page: StructurePage, kind: StructureNote["kind"]): boolean {
  return page.notes.some((note) => note.kind === kind)
}

function rowHasDifference(row: StructurePageRow, courses: LanguageVersionCourse[]): boolean {
  if (row.pages.length < courses.length || row.pages.some((page) => page.notes.length > 0)) {
    return true
  }
  const counts = new Set(row.pages.map((page) => page.page.exercise_count))
  return (
    counts.size > 1 ||
    row.exercise_rows.some((exerciseRow) => exerciseRow.exercises.length < courses.length)
  )
}

/** The language versions side by side: chapters by number, pages by their links. */
const StructureComparison: React.FC<Props> = ({ courseId }) => {
  const { t } = useTranslation()
  const languageName = useLanguageName()
  const canEditAllCourses = useContext(CanEditAllCoursesContext)
  const structureQuery = useLanguageVersionStructure(courseId)
  const { control, watch } = useForm<Fields>({ defaultValues: { isDifferencesOnly: false } })
  const isDifferencesOnly = watch("isDifferencesOnly")
  const [openRows, setOpenRows] = useState<Set<string>>(new Set())

  const toggleRow = (key: string) =>
    setOpenRows((previous) => {
      const next = new Set(previous)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })

  const renderChapter = (chapter: StructureChapterRow, courses: LanguageVersionCourse[]) => {
    const grid = gridCss(courses.length)
    const chapterId = String(chapter.chapter_number ?? OUTSIDE_CHAPTERS)
    const referenceCourseId = courses[0]?.id ?? courseId
    return (
      <div key={chapterId} className={chapterCss}>
        <div className={cx(grid, chapterHeadCss)}>
          {courses.map((course) => {
            const ownChapter = chapter.chapters.find((item) => item.course_id === course.id)
            const pageCount = chapter.rows.filter((row) => pageOfCourse(row, course.id)).length
            return (
              <div key={course.id}>
                <LanguageChip code={course.language_code} className={chipBeforeTextCss} />
                {chapter.chapter_number === null || chapter.chapter_number === undefined
                  ? t("language-versions-no-chapter")
                  : (ownChapter?.name ??
                    t("language-versions-chapter-number", { number: chapter.chapter_number }))}
                <span className={cx(smallMutedCss, countCss)}>
                  {t("language-versions-page-count", { count: pageCount })}
                </span>
              </div>
            )
          })}
        </div>
        {chapter.rows.map((row, rowIndex) => {
          const rowKey = `${chapterId}-${rowIndex}`
          const reference = pageOfCourse(row, referenceCourseId)
          const referenceExerciseCount = reference?.exercise_count ?? 0
          const isOpen = openRows.has(rowKey)
          const presentCount = row.pages.length
          return (
            <React.Fragment key={rowKey}>
              <div className={cx(grid, rowCss)}>
                {courses.map((course, courseIndex) => {
                  const structurePage = row.pages.find((item) => item.page.course_id === course.id)
                  if (!structurePage) {
                    const source = row.pages[0]?.page
                    return (
                      <div key={course.id} className={missingCss}>
                        <div className={pageLineCss}>
                          <span className={positionCss} />
                          <span className={problemTextCss}>{t("language-versions-missing")}</span>
                        </div>
                        <span className={cx(smallMutedCss, noteCss)}>
                          {t("language-versions-structure-no-counterpart", {
                            language: languageName(course.language_code),
                          })}{" "}
                          {source && canEditAllCourses && (
                            <Link
                              href={manageCreateCounterpartRoute(
                                source.course_id,
                                source.id,
                                course.language_code,
                              )}
                            >
                              {t("language-versions-create-counterpart")}
                            </Link>
                          )}
                        </span>
                      </div>
                    )
                  }
                  const page = structurePage.page
                  const differentPosition = structurePage.notes.find(
                    (note) => note.kind === "different_position",
                  )
                  const otherChapter = structurePage.notes.find(
                    (note) => note.kind === "in_other_chapter_number",
                  )
                  const exercisesElsewhere = structurePage.notes.find(
                    (note) => note.kind === "exercises_on_other_page",
                  )
                  const toneCss = differentPosition
                    ? differentOrderCss
                    : presentCount === 1 && courses.length > 1
                      ? onlyOneCss
                      : undefined
                  return (
                    <div key={course.id} className={toneCss}>
                      <div className={pageLineCss}>
                        <span className={cx(smallMutedCss, positionCss)}>{page.position}</span>
                        <span className={titleCss}>{page.title}</span>
                        <span
                          className={cx(
                            smallMutedCss,
                            countCss,
                            page.exercise_count < referenceExerciseCount && lessCss,
                          )}
                        >
                          {t("language-versions-exercises-short", { count: page.exercise_count })}
                        </span>
                      </div>
                      {differentPosition && differentPosition.kind === "different_position" && (
                        <span className={cx(smallMutedCss, noteCss)}>
                          {t("language-versions-note-different-position", {
                            position: page.position,
                            reference: differentPosition.reference_position,
                          })}
                        </span>
                      )}
                      {otherChapter && otherChapter.kind === "in_other_chapter_number" && (
                        <span className={cx(smallMutedCss, noteCss)}>
                          {t("language-versions-note-other-chapter", {
                            chapter: page.chapter_number ?? "",
                            reference: otherChapter.reference_chapter_number,
                          })}
                        </span>
                      )}
                      {hasNote(structurePage, NOTE_DUPLICATE_IN_GROUP) && (
                        <span className={cx(smallMutedCss, noteCss)}>
                          {t("language-versions-note-duplicate", {
                            language: languageName(course.language_code),
                          })}
                        </span>
                      )}
                      {hasNote(structurePage, NOTE_FOREIGN_COURSE_LINK) && (
                        <span className={cx(smallMutedCss, noteCss)}>
                          {t("language-versions-note-foreign-link")}
                        </span>
                      )}
                      {exercisesElsewhere &&
                        exercisesElsewhere.kind === "exercises_on_other_page" && (
                          <span className={cx(smallMutedCss, noteCss)}>
                            {t("language-versions-note-exercises-elsewhere", {
                              count: exercisesElsewhere.exercise_count,
                            })}
                          </span>
                        )}
                      {courseIndex === 0 && row.exercise_rows.length > 0 && (
                        <span className={noteCss}>
                          <Button variant="link" onPress={() => toggleRow(rowKey)}>
                            {isOpen
                              ? t("language-versions-hide-exercises")
                              : t("language-versions-show-exercises")}
                          </Button>
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              {isOpen &&
                row.exercise_rows.map((exerciseRow, exerciseIndex) => (
                  <div
                    key={`${rowKey}-${exerciseIndex}`}
                    className={cx(grid, rowCss, exerciseRowCss)}
                  >
                    {courses.map((course) => {
                      const item = exerciseRow.exercises.find(
                        (candidate) => candidate.exercise.course_id === course.id,
                      )
                      if (!item) {
                        return (
                          <div key={course.id} className={missingCss}>
                            <span className={problemTextCss}>{t("language-versions-missing")}</span>
                          </div>
                        )
                      }
                      return (
                        <div
                          key={course.id}
                          className={item.is_on_other_page ? differentOrderCss : undefined}
                        >
                          {item.exercise.name}
                          {item.is_on_other_page && (
                            <span className={smallMutedCss}>
                              {" "}
                              {t("language-versions-on-page", { page: item.exercise.page_title })}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
            </React.Fragment>
          )
        })}
      </div>
    )
  }

  return (
    <section className={sectionCss}>
      <h2>{t("language-versions-structure-title")}</h2>
      <p className={leadCss}>{t("language-versions-structure-lead")}</p>
      <div className={toolbarCss}>
        <Checkbox
          name="isDifferencesOnly"
          control={control}
          isInline
          label={t("language-versions-only-differences")}
        />
        <div className={legendCss}>
          <span>
            <i className={missingCss} />
            {t("language-versions-legend-missing")}
          </span>
          <span>
            <i className={onlyOneCss} />
            {t("language-versions-legend-only-one")}
          </span>
          <span>
            <i className={differentOrderCss} />
            {t("language-versions-legend-different-order")}
          </span>
          <span>{t("language-versions-legend-exercises")}</span>
        </div>
      </div>
      <QueryResult query={structureQuery}>
        {(structure) => {
          const courses = orderCourses(structure.courses, courseId)
          const chapters = isDifferencesOnly
            ? structure.chapters.filter((chapter) =>
                chapter.rows.some((row) => rowHasDifference(row, courses)),
              )
            : structure.chapters
          return (
            <div className={scrollCss}>
              {chapters.map((chapter) => renderChapter(chapter, courses))}
            </div>
          )
        }}
      </QueryResult>
    </section>
  )
}

export default StructureComparison
