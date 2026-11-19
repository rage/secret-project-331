"use client"

import { css } from "@emotion/css"
import type { TFunction } from "i18next"
import React, { useCallback, useContext } from "react"
import { useTranslation } from "react-i18next"

import type {
  JoinBlockedReason,
  LanguageVersionCourse,
  LanguageVersionPage,
  LanguageVersionStructure,
  StructureChapterRow,
  StructureExerciseRow,
  StructurePageRow,
  SuggestionReason,
  SuggestionSureness,
} from "@/generated/api/types.generated"
import useLanguageName from "@/shared-module/common/hooks/useLanguageName"
import { Badge, type DialogAction, Tooltip } from "@/shared-module/components"

/** How many names a problem description lists before "and N more". */
export const LISTED_ITEM_LIMIT = 3

export const sectionCss = css`
  display: grid;
  gap: var(--space-4);
  min-width: 0;

  h2,
  h3,
  p {
    margin: 0;
  }

  h2,
  h3 {
    font-weight: 600;
    line-height: 1.3;
  }

  h2 {
    font-size: var(--font-size-4);
  }

  h3 {
    font-size: var(--font-size-3);
  }
`

export const sectionHeadCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);

  h2 {
    font-size: var(--font-size-4);
  }
`

export const headActionsCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
`

export const subHeadCss = css`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-3);

  h3 {
    font-size: var(--font-size-2);
  }
`

export const leadCss = css`
  max-width: 70ch;
  color: var(--color-gray-600);
`

export const mutedCss = css`
  color: var(--color-gray-500);
`

export const hintCss = css`
  display: block;
  margin-top: var(--space-1);
  font-size: var(--font-size-1);
  color: var(--color-gray-500);
`

export const toolbarCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
`

export const dialogBodyCss = css`
  display: grid;
  gap: var(--space-4);

  h3,
  p,
  ul {
    margin: 0;
  }

  h3 {
    font-size: var(--font-size-2);
  }
`

export const bulletsCss = css`
  display: grid;
  gap: var(--space-2);
  padding-left: var(--space-5);
`

/** A bordered list of rows, each with content on the left and actions on the right. */
export const rowsCss = css`
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--color-gray-100);
  border-radius: var(--control-radius);
  background: #fff;

  > li {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3) var(--space-4);
    padding: var(--space-4);
  }

  > li + li {
    border-top: 1px solid var(--color-gray-100);
  }
`

export const rowMainCss = css`
  display: grid;
  flex: 1 1 24rem;
  gap: var(--space-1);
  min-width: 0;
`

export const rowTitleCss = css`
  font-weight: 600;
  color: var(--color-gray-700);
`

export const rowDescCss = css`
  font-size: var(--font-size-1);
  color: var(--color-gray-600);
`

export const rowSideCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
`

export const dimmedRowCss = css`
  opacity: 0.7;
`

/** Spacing for a `LanguageChip` followed by text. */
export const chipBeforeTextCss = css`
  margin-right: var(--space-2);
`

/** Joins names into "A, B and 3 more", listing at most `limit`. */
export function useListFormatter(): (names: string[], limit?: number) => string {
  const { t, i18n } = useTranslation()
  return useCallback(
    (names: string[], limit = LISTED_ITEM_LIMIT) => {
      const shown = names.slice(0, limit)
      if (names.length > limit) {
        shown.push(t("language-versions-n-more", { count: names.length - limit }))
      }
      // oxlint-disable-next-line i18next/no-literal-string
      return new Intl.ListFormat(i18n.language, { type: "conjunction" }).format(shown)
    },
    [i18n.language, t],
  )
}

/**
 * "Osa 4 › Title" with the chapter's own name, or the title alone for a page outside chapters or
 * a chapter front page.
 */
export function pageLabel(t: TFunction, page: LanguageVersionPage): string {
  if (
    page.chapter_number === null ||
    page.chapter_number === undefined ||
    page.is_chapter_front_page
  ) {
    return page.title
  }
  const chapter =
    page.chapter_name || t("language-versions-chapter-number", { number: page.chapter_number })
  return t("language-versions-page-in-chapter", { chapter, title: page.title })
}

/** The tool's own course first, then the others by language code. */
export function orderCourses(
  courses: LanguageVersionCourse[],
  courseId: string,
): LanguageVersionCourse[] {
  return courses.toSorted((a, b) => {
    if (a.id === courseId) {
      return -1
    }
    if (b.id === courseId) {
      return 1
    }
    return a.language_code.localeCompare(b.language_code)
  })
}

export function courseById(
  courses: LanguageVersionCourse[],
  id: string,
): LanguageVersionCourse | undefined {
  return courses.find((course) => course.id === id)
}

/** The page of `courseId` on a structure row, if it has one. */
export function pageOfCourse(row: StructurePageRow, courseId: string) {
  return row.pages.find((structurePage) => structurePage.page.course_id === courseId)?.page
}

/** The row holding `pageId` and its chapter row. */
export function findPageRow(
  structure: LanguageVersionStructure,
  pageId: string,
): { chapter: StructureChapterRow; row: StructurePageRow } | null {
  for (const chapter of structure.chapters) {
    for (const row of chapter.rows) {
      if (row.pages.some((structurePage) => structurePage.page.id === pageId)) {
        return { chapter, row }
      }
    }
  }
  return null
}

/** The exercise row holding `exerciseId`. */
export function findExerciseRow(
  structure: LanguageVersionStructure,
  exerciseId: string,
): StructureExerciseRow | null {
  for (const chapter of structure.chapters) {
    for (const row of chapter.rows) {
      for (const exerciseRow of row.exercise_rows) {
        if (exerciseRow.exercises.some((item) => item.exercise.id === exerciseId)) {
          return exerciseRow
        }
      }
    }
  }
  return null
}

/** Pages of `courseId` with the given chapter number, each with its structure row. */
export function pagesInChapter(
  structure: LanguageVersionStructure,
  courseId: string,
  chapterNumber: number | null | undefined,
): { page: LanguageVersionPage; row: StructurePageRow }[] {
  const chapter = structure.chapters.find(
    (candidate) => (candidate.chapter_number ?? null) === (chapterNumber ?? null),
  )
  if (!chapter) {
    return []
  }
  return chapter.rows.flatMap((row) => {
    const page = pageOfCourse(row, courseId)
    return page ? [{ page, row }] : []
  })
}

const SURENESS_TONE = {
  very_sure: "success",
  likely: "info",
  unsure: "warning",
} as const

const SURENESS_LABEL_KEY = {
  very_sure: "language-versions-sure-very-likely",
  likely: "language-versions-sure-likely",
  unsure: "language-versions-sure-unsure",
} as const

const REASON_KEY = {
  already_linked: "language-versions-reason-already-linked",
  copy_history: "language-versions-reason-copy-history",
  same_position_and_exercise_count: "language-versions-reason-same-position-and-exercise-count",
  same_position: "language-versions-reason-same-position",
  same_position_and_exercise_types: "language-versions-reason-same-position-and-exercise-types",
} as const

export function suggestionReasonText(t: TFunction, reason: SuggestionReason): string {
  return t(REASON_KEY[reason])
}

/** How sure a suggestion is, with the reason behind it in a tooltip. */
export const SurenessBadge: React.FC<{
  sureness: SuggestionSureness
  reason: SuggestionReason | null | undefined
}> = ({ sureness, reason }) => {
  const { t } = useTranslation()
  const badge = (
    <Badge size="compact" tone={SURENESS_TONE[sureness]}>
      {t(SURENESS_LABEL_KEY[sureness])}
    </Badge>
  )
  if (!reason) {
    return badge
  }
  const reasonText = suggestionReasonText(t, reason)
  return (
    <Tooltip aria-label={reasonText} trigger={badge}>
      {reasonText}
    </Tooltip>
  )
}

/** "7 chapters, 32 pages, 229 exercises". */
export function courseContentText(t: TFunction, course: LanguageVersionCourse): string {
  return t("language-versions-course-content", {
    chapters: t("language-versions-chapter-count", { count: course.chapter_count }),
    pages: t("language-versions-page-count", { count: course.page_count }),
    exercises: t("language-versions-exercise-count", { count: course.exercise_count }),
  })
}

/**
 * "Draft, no students", "No students" or "1,840 students". Only courses from the report, join
 * candidates and previews carry a student count.
 */
export function studentCountText(t: TFunction, course: LanguageVersionCourse): string {
  if (hasStudents(course)) {
    return t("language-versions-student-count", { count: course.student_count })
  }
  return course.is_draft
    ? t("language-versions-draft-no-students")
    : t("language-versions-no-students")
}

/** Whether the course has students; `false` when the response carries no count. */
export function hasStudents(
  course: LanguageVersionCourse,
): course is LanguageVersionCourse & { student_count: number } {
  return (course.student_count ?? 0) > 0
}

/** Why a course can't join, or `null`. */
export function useBlockedReasonText(): (
  reason: JoinBlockedReason | null | undefined,
  course: LanguageVersionCourse,
) => string | null {
  const { t } = useTranslation()
  const languageName = useLanguageName()
  return useCallback(
    (reason, course) => {
      if (reason === "already_language_version") {
        return t("language-versions-blocked-already-version")
      }
      if (reason === "language_already_present") {
        return t("language-versions-blocked-language-present", {
          language: languageName(course.language_code),
        })
      }
      return null
    },
    [t, languageName],
  )
}

/** The Cancel button of the tool's dialogs. */
export function cancelAction(t: TFunction, onClose: () => void): DialogAction {
  return { label: t("button-text-cancel"), variant: "secondary", onPress: onClose }
}

/**
 * Ids of the other items linked with `item` on its structure row, leaving out `item` and the
 * counterpart in `replacedCourseId`, so a relink keeps the rest of the group linked.
 */
export function otherLanguageCounterpartIds(
  rowItems: { id: string; course_id: string }[],
  itemId: string,
  replacedCourseId: string,
): string[] {
  return rowItems
    .filter((other) => other.id !== itemId && other.course_id !== replacedCourseId)
    .map((other) => other.id)
}

/** Whether the user can edit every course of the language versions; links span all of them. */
export const CanEditAllCoursesContext = React.createContext(false)

/** Why the tool's editing actions are disabled, or `undefined` when they are not. */
export function useReadOnlyReason(): string | undefined {
  const { t } = useTranslation()
  const canEditAllCourses = useContext(CanEditAllCoursesContext)
  return canEditAllCourses ? undefined : t("language-versions-read-only-reason")
}
