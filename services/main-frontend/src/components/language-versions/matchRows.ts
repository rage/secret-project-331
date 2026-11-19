import type { TFunction } from "i18next"
import { useEffect } from "react"
import type { Key } from "react-aria"

import type {
  CounterpartLinkChange,
  ExerciseLinkSuggestion,
  LanguageVersionExercise,
  LanguageVersionPage,
  PageLinkSuggestion,
  SuggestedExerciseCounterpart,
  SuggestedPageCounterpart,
  SuggestionReason,
  SuggestionSureness,
} from "@/generated/api/types.generated"

import { LINK, OUTSIDE_CHAPTERS, UNLINK } from "./constants"

/** Select value for "No counterpart". */
export const NO_COUNTERPART = "none"

/** One cell: the linked or suggested counterpart in one course, and what else could be picked. */
export interface MatchCounterpart {
  courseId: string
  suggestedId: string | null
  isLinked: boolean
  sureness: SuggestionSureness | null
  reason: SuggestionReason | null
  options: { id: string; label: string }[]
  hint: string | null
}

/** A page or exercise of the reference course and its counterparts. */
export interface MatchRow {
  id: string
  label: string
  group: { key: string; label: string } | null
  counterparts: MatchCounterpart[]
}

/** Picked counterpart ids by row id and course id, and the rows the teacher accepted. */
export interface MatchFields {
  picks: Record<string, Record<string, string>>
  accepted: Record<string, boolean>
}

/** Initial picks: the linked or suggested counterpart, else "No counterpart". */
export function initialMatchFields(rows: MatchRow[], acceptVerySure: boolean): MatchFields {
  const picks: MatchFields["picks"] = {}
  const accepted: MatchFields["accepted"] = {}
  for (const row of rows) {
    picks[row.id] = Object.fromEntries(
      row.counterparts.map((counterpart) => [
        counterpart.courseId,
        counterpart.suggestedId ?? NO_COUNTERPART,
      ]),
    )
    const pending = row.counterparts.filter(
      (counterpart) => counterpart.suggestedId !== null && !counterpart.isLinked,
    )
    accepted[row.id] =
      acceptVerySure &&
      pending.length > 0 &&
      pending.every((counterpart) => counterpart.sureness === "very_sure")
  }
  return { picks, accepted }
}

/** Whether a row's picks differ from what is linked now. */
export function rowChangesLinks(row: MatchRow, picks: Record<string, string> | undefined): boolean {
  return row.counterparts.some((counterpart) => {
    const pick = picks?.[counterpart.courseId] ?? NO_COUNTERPART
    const linkedId = counterpart.isLinked ? counterpart.suggestedId : null
    return (pick === NO_COUNTERPART ? null : pick) !== linkedId
  })
}

/** Ids to link for an accepted row: the reference and every picked counterpart. */
export function linkIdsForRow(row: MatchRow, picks: Record<string, string> | undefined): string[] {
  return [
    row.id,
    ...row.counterparts
      .map((counterpart) => picks?.[counterpart.courseId] ?? NO_COUNTERPART)
      .filter((pick) => pick !== NO_COUNTERPART),
  ]
}

type LanguageName = (code: string) => string

function uniqueOptions<T extends { id: string }>(
  items: (T | null | undefined)[],
  label: (item: T) => string,
): { id: string; label: string }[] {
  const seen = new Set<string>()
  const options: { id: string; label: string }[] = []
  for (const item of items) {
    if (item && !seen.has(item.id)) {
      seen.add(item.id)
      options.push({ id: item.id, label: label(item) })
    }
  }
  return options
}

/**
 * Courses outside `visibleCourseIds` keep only their current link, so saving a row never
 * links a suggestion the teacher did not see.
 */
function baseCounterpart(
  counterpart: SuggestedPageCounterpart | SuggestedExerciseCounterpart,
  itemId: string | undefined,
  visibleCourseIds: Set<string>,
): Pick<MatchCounterpart, "courseId" | "suggestedId" | "isLinked" | "sureness" | "reason"> {
  const isVisible = visibleCourseIds.has(counterpart.course_id)
  return {
    courseId: counterpart.course_id,
    suggestedId: isVisible || counterpart.is_linked ? (itemId ?? null) : null,
    isLinked: counterpart.is_linked,
    sureness: isVisible ? (counterpart.sureness ?? null) : null,
    reason: isVisible ? (counterpart.reason ?? null) : null,
  }
}

/** Page suggestions as match rows. */
export function pageMatchRows(
  t: TFunction,
  languageName: LanguageName,
  suggestions: PageLinkSuggestion[],
  visibleCourseIds: Set<string>,
): MatchRow[] {
  return suggestions.map((suggestion) => ({
    id: suggestion.reference.id,
    label: suggestion.reference.title,
    group: null,
    counterparts: suggestion.counterparts.map((counterpart) => {
      const page: LanguageVersionPage | null | undefined = counterpart.page
      return {
        ...baseCounterpart(counterpart, page?.id, visibleCourseIds),
        options: uniqueOptions([page, ...counterpart.alternatives], (item) => item.title),
        hint:
          page && page.position !== suggestion.reference.position
            ? t("language-versions-position-in-language", {
                position: page.position,
                language: languageName(page.language_code),
              })
            : null,
      }
    }),
  }))
}

/** Exercise suggestions as match rows, grouped by the reference exercise's page. */
export function exerciseMatchRows(
  t: TFunction,
  languageName: LanguageName,
  suggestions: ExerciseLinkSuggestion[],
  visibleCourseIds: Set<string>,
): MatchRow[] {
  return suggestions.map((suggestion) => ({
    id: suggestion.reference.id,
    label: suggestion.reference.name,
    group: { key: suggestion.reference.page_id, label: suggestion.reference.page_title },
    counterparts: suggestion.counterparts.map((counterpart) => {
      const exercise: LanguageVersionExercise | null | undefined = counterpart.exercise
      return {
        ...baseCounterpart(counterpart, exercise?.id, visibleCourseIds),
        options: uniqueOptions([exercise, ...counterpart.alternatives], (item) => item.name),
        hint:
          exercise && counterpart.is_on_other_page
            ? t("language-versions-on-page-in-language", {
                page: exercise.page_title,
                language: languageName(exercise.language_code),
              })
            : null,
      }
    }),
  }))
}

/** Whether a row suggests a counterpart that is not linked yet. */
export function hasPendingSuggestion(row: MatchRow): boolean {
  return row.counterparts.some(
    (counterpart) => counterpart.suggestedId !== null && !counterpart.isLinked,
  )
}

/**
 * Whether a row is accepted: by the teacher, or by changing its picks by hand. `picks` and
 * `isAccepted` are the row's own entries in `MatchFields`.
 */
export function isRowAccepted(
  row: MatchRow,
  picks: Record<string, string> | undefined,
  isAccepted: boolean | undefined,
): boolean {
  if (isAccepted) {
    return true
  }
  return row.counterparts.some(
    (counterpart) =>
      (picks?.[counterpart.courseId] ?? NO_COUNTERPART) !==
      (counterpart.suggestedId ?? NO_COUNTERPART),
  )
}

/** What the teacher's picks in a match table add up to. */
export interface MatchSummary {
  /** The link changes that save the accepted rows. */
  changes: CounterpartLinkChange[]
  acceptedCount: number
  /** Rows with a suggestion the teacher has not accepted yet. */
  pendingCount: number
}

/**
 * Sums up `rows` for the buttons and counts around a match table; pass it to `useWatch`'s
 * `compute` so the parent re-renders only when the sums change.
 */
export function summarizeMatches(rows: MatchRow[], fields: MatchFields): MatchSummary {
  const summary: MatchSummary = { changes: [], acceptedCount: 0, pendingCount: 0 }
  for (const row of rows) {
    const picks = fields.picks[row.id]
    const isAccepted = isRowAccepted(row, picks, fields.accepted[row.id])
    if (isAccepted) {
      summary.acceptedCount += 1
    } else if (hasPendingSuggestion(row)) {
      summary.pendingCount += 1
    }
    if (isAccepted && rowChangesLinks(row, picks)) {
      const ids = linkIdsForRow(row, picks)
      summary.changes.push(ids.length > 1 ? { action: LINK, ids } : { action: UNLINK, id: row.id })
    }
  }
  return summary
}

/** Chapter key of a chapter number, `OUTSIDE_CHAPTERS` for pages outside chapters. */
export function chapterKey(chapterNumber: number | null | undefined): string {
  return chapterNumber === null || chapterNumber === undefined
    ? OUTSIDE_CHAPTERS
    : String(chapterNumber)
}

/** Chapter key of each suggestion's reference item, by its id. */
export function chapterOfRows(
  suggestions: { reference: { id: string; chapter_number?: number | null } }[],
): Map<string, string> {
  return new Map(
    suggestions.map((suggestion) => [
      suggestion.reference.id,
      chapterKey(suggestion.reference.chapter_number),
    ]),
  )
}

/**
 * The chapter picked in a chapter picker, picking the first of `keys` once they load so the
 * picker never shows nothing selected.
 */
export function useDefaultChapter(
  picked: Set<Key>,
  keys: string[],
  pick: (key: string) => void,
): string | undefined {
  const firstKey = keys[0]
  useEffect(() => {
    if (picked.size === 0 && firstKey !== undefined) {
      pick(firstKey)
    }
  }, [picked, firstKey, pick])
  const pickedKey = [...picked][0]
  return pickedKey === undefined ? firstKey : String(pickedKey)
}
